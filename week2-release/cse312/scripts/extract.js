"use strict";
/*
  Reads every stateful item straight from site/index.html, as the browser parses it, with the site's own
  scripts blocked so the DOM is exactly the authored markup (TeX not yet rendered, no generated inputs).

  extract({ withKeys }) → [{ id, kind, parentId, route, ... }]
  withKeys=true adds answer keys and misconception expressions; that is for tests only and is never exported.
*/
const path = require("path");
const { start } = require("../tests/serve.js");
const { launch } = require("../tests/browser.js");

async function extract({ withKeys = false } = {}) {
  const { server, url } = await start();
  const browser = await launch();
  try {
    const page = await browser.newPage();
    await page.route("**/*.js", (r) => r.abort());
    await page.goto(url, { waitUntil: "domcontentloaded" });
    const items = await page.evaluate((withKeys) => {
      const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
      const text = (node) => (node ? node.textContent.replace(/\s+/g, " ").trim() : "");
      const html = (node) => (node ? node.innerHTML.replace(/\s+/g, " ").trim() : "");
      // plain-text rendering of authored TeX: drop \( \) delimiters, keep the TeX itself readable
      const plain = (s) => s.replace(/\\\(|\\\)|\\\[|\\\]/g, "").replace(/\s+/g, " ").trim();
      // Week 2 timing as of Mon Oct 5, 2026: Lecture 3 is today; Lectures 4 and 5 are upcoming (slides posted early).
      const DATES = {
        "l3-": { session: "Lecture 3", date: "2026-10-05", timing: "today" },
        "l4-": { session: "Lecture 4", date: "2026-10-07", timing: "upcoming" },
        "l5-": { session: "Lecture 5", date: "2026-10-09", timing: "upcoming" },
        readings: { session: "Readings", date: null, timing: null },
      };
      const sessionOf = (route) => {
        for (const [k, v] of Object.entries(DATES)) if (route.startsWith(k)) return v;
        return { session: null, date: null, timing: null };
      };
      const misconOf = (node) => {
        const ul = node.querySelector(":scope > ul.miscon");
        return ul ? $$("li", ul).map((li) => ({ tag: li.dataset.tag, feedback: plain(li.textContent), ...(withKeys ? { expr: li.dataset.expr } : {}) })) : [];
      };
      const graderOf = (node) => {
        const t = node.dataset.type || "exact";
        if (t === "exact") return "exact-expression";
        if (t === "formula") return "formula";
        if (t === "yesno") return "yes-no";
        if (t === "self") return "self-check";
        return t;
      };
      const out = [];

      $$(".task[data-id]").forEach((task) => {
        const page = task.closest(".page");
        const route = page.id;
        const prompt = task.querySelector(".prompt");
        const specs = $$(".answer-spec", task);
        const sess = sessionOf(route);
        const hints = $$(".hints li", task);
        out.push({
          id: task.dataset.id,
          kind: "problem",
          parentId: null,
          route: `#${route}`,
          page: page.dataset.title,
          session: sess.session,
          date: sess.date,
          timing: sess.timing,
          title: text(task.querySelector("h2")),
          prompt: { text: plain(prompt.textContent), html: html(prompt) },
          grader: specs.every((s) => s.dataset.type === "self") ? "self-check" : "multi-part",
          parts: specs.map((s) => s.dataset.partId),
          hintCount: hints.length,
          hints: hints.map((li) => plain(li.textContent)),
          hasSolution: Boolean(task.querySelector(".solution .steps li")),
          solutionStepCount: $$(".solution .steps li", task).length,
          hasBruteForce: Boolean(task.querySelector("[data-brute]")),
          legacyIds: (task.dataset.legacyIds || "").split(/\s+/).filter(Boolean),
        });
        specs.forEach((s) => {
          const item = {
            id: s.dataset.partId,
            kind: "part",
            parentId: task.dataset.id,
            route: `#${route}`,
            page: page.dataset.title,
            session: sess.session,
            date: sess.date,
            timing: sess.timing,
            label: s.dataset.label ? { text: plain(s.dataset.label), html: s.dataset.label } : null,
            prompt: { text: plain(prompt.textContent) + (s.dataset.label ? ` [${plain(s.dataset.label)}]` : ""), html: html(prompt) },
            grader: graderOf(s),
            variables: s.dataset.vars ? Object.keys(JSON.parse(s.dataset.vars)) : undefined,
            misconceptions: misconOf(s),
          };
          if (withKeys) { item.near = s.dataset.near || null; item.answer = s.dataset.answer || null; item.vars = s.dataset.vars ? JSON.parse(s.dataset.vars) : null; }
          out.push(item);
        });
      });

      $$(".check[data-id]").forEach((box) => {
        const page = box.closest(".page");
        const sess = sessionOf(page.id);
        const q = box.querySelector(":scope > p");
        const item = {
          id: box.dataset.id,
          kind: "quickcheck",
          parentId: null,
          route: `#${page.id}`,
          page: page.dataset.title,
          session: sess.session,
          date: sess.date,
          timing: sess.timing,
          prompt: { text: plain(q.textContent), html: html(q) },
          grader: graderOf(box),
          hintCount: 0,
          hasSolution: false,
          misconceptions: misconOf(box),
        };
        if (withKeys) { item.answer = box.dataset.answer; item.near = box.dataset.near || null; }
        out.push(item);
      });

      $$(".cyu[data-id]").forEach((li) => {
        const page = li.closest(".page");
        const sess = sessionOf(page.id);
        const q = li.querySelector(".q");
        const isMc = li.dataset.kind === "mc";
        const item = {
          id: li.dataset.id,
          kind: "quiz",
          parentId: `cse312-w2-${page.id}`,
          route: `#${page.id}`,
          page: page.dataset.title,
          session: sess.session,
          date: sess.date,
          timing: sess.timing,
          reviewRoute: `#${li.dataset.topic}`,
          prompt: { text: plain(q.textContent), html: html(q) },
          grader: isMc ? "multiple-choice" : "exact-expression",
          options: isMc ? $$("label[data-opt]", li).map((l, i) => {
            const clone = l.cloneNode(true);
            clone.querySelectorAll(".why, input").forEach((n) => n.remove());
            return { value: l.dataset.opt, index: i, text: plain(clone.textContent), html: html(clone) };
          }) : undefined,
          hintCount: 0,
          hasSolution: Boolean(li.querySelector(".why")),
          misconceptions: isMc ? undefined : misconOf(li),
        };
        if (withKeys) {
          item.answer = isMc ? li.querySelector("label[data-correct]").dataset.opt : li.dataset.answer;
          if (!isMc) item.near = li.dataset.near || null;
          if (isMc) item.correctCount = li.querySelectorAll("label[data-correct]").length;
        }
        out.push(item);
      });
      return out;
    }, withKeys);
    return items;
  } finally {
    await browser.close();
    server.close();
  }
}

module.exports = { extract, SITE: path.resolve(__dirname, "../site") };
