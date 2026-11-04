<img src="assets/icon.svg" width="64" height="64" alt="">

# school

One study site for every course week (CSE 331, CSE 332), deployed as a ChatGPT Site.
See [CLAUDE.md](CLAUDE.md) for the layout and how to add a week.

```
bun install
bun dev                                 # http://localhost:8400/, saving included
bun check                               # every posted week, desktop + phone
bun checks/cse332/w02/verify.mjs        # a week's answers against real code
```
