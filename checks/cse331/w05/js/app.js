




// Puts the messages on the page, one list item each, in place of
// whatever the list held before.
function show(messages) {
  const list = document.getElementById("messages");
  list.innerHTML = "";
  for (const message of messages) {
    const item = document.createElement("li");
    item.textContent = message;
    list.appendChild(item);
  }
}

// Asks the server for the messages, and shows them.
async function load() {
  const response = await fetch("/api/messages");
  const messages = await response.json();
  show(messages);
}

// Sends the name and message typed in, and shows what comes back.
async function post() {
  const fields = new URLSearchParams();
  fields.append("name", document.getElementById("name").value);
  fields.append("message", document.getElementById("message").value);
  const response = await fetch("/api/messages", {
    method: "POST",
    body: fields,
  });
  const messages = await response.json();
  show(messages);
  document.getElementById("message").value = "";
}

document.getElementById("post").onclick = post;
load();
