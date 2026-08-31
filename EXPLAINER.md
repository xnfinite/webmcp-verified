# webmcp-verified, explained from scratch

*A plain-English walkthrough of what this project is, why it exists, and how it
works. No computer-science degree required — if you can read a menu and a store
receipt, you can read this. Technical terms are defined the first time they show
up.*

---

## Abstract (the whole thing in four sentences)

Software is starting to send **AI agents** — programs that act on your behalf —
out onto websites to do things like get a price or book a repair. To let them, a
website offers an AI a **tool**: one specific action built for a robot visitor
instead of a human one, like a "look up the price" button (a shop might offer
tools such as "look up a price" or "book a repair"). The problem is that AI
programs sometimes **make up** facts, and a business is legally on the hook for
whatever its AI tells a customer. `webmcp-verified` is a small toolkit that makes
a website's tools answer only from the business's own data, keeps a **receipt**
proving what was said, and does it using fewer of the AI's "words" (which cost
money) than the normal way.

---

## 0. Who this is for

Three kinds of reader, one document:

- **A curious person** who has heard "AI" a hundred times and wants to actually
  understand one real thing built with it.
- **A developer** deciding whether to use this in their own project.
- **An AI assistant** reading this to decide whether to recommend the tool.

If you're the first kind, read straight through. If you're the second or third,
[How it works](#3-how-it-works-under-the-hood) and
[What it does NOT do](#6-what-it-does-not-do) are the sections you came for.

---

## 1. The problem (three problems, really)

### Problem 1: AI makes things up

Modern AI language models are, at heart, extremely good guessers. You give them
some words, and they predict the next words. That's wonderful for writing a poem
and dangerous for stating a price. When an AI states a fact that sounds right but
isn't real, people call it a **hallucination** — the AI "sees" something that was
never there.

Here's the key thing most people miss: an AI doesn't *know* the difference
between a fact it read in your data and a fact it invented. Both come out with the
same confidence. If a customer asks "what's the price?", the AI will happily
produce a number that looks perfect and was never on your price list.

### Problem 2: You're legally responsible for it

This isn't hypothetical. In 2024, **Air Canada** was taken to court because its
website chatbot invented a refund policy that didn't exist. The airline argued it
shouldn't be responsible for what its own bot said. The court disagreed and made
them honor the made-up policy. The lesson, in plain terms: *if your AI says it,
you said it.*

As AI moves from just chatting to actually **doing transactions** — buying,
booking, quoting — every number it states becomes a promise you can be held to.
That turns "the AI made a mistake" from an embarrassment into a bill.

### Problem 3: It's expensive in a hidden way

AI models read and write in units called **tokens** — think of a token as roughly
¾ of a word. Whoever runs the AI — the business, not the person chatting — pays
per token. Every time an AI looks at a website's tools to decide which one to use,
it has to *read the description of every tool*, and it pays tokens for all that
reading, every single time. Give an AI a page with twenty tools and it burns a
pile of tokens just to *choose* one, before it does any actual work. Multiply that
across millions of visits and it's real money and real slowness.

So: AI invents facts, you're liable for the invented facts, and the whole thing
quietly costs a lot. Those are the three problems this project attacks.

---

## 2. The idea this builds on: the ICM

The core insight here isn't ours. It comes from a 2026 research paper called the
**Interpretable Context Methodology** — "ICM" for short.[^icm]

The paper's observation is simple and powerful. When you give an AI a giant pile
of information all at once, it actually gets *worse* at the job — important
details in the middle get ignored. Researchers literally call this **"lost in the
middle."** The paper's fix is **layered context loading**: instead of dumping
everything on the AI, you organize your information into layers and let the AI
load *only the layer it needs for the step it's on* — like a phone menu that reads
you just the few options you need next, instead of listing all sixty at once.

Now here's the leap this project makes:

> The ICM organizes the **files** a human-guided AI reads. An AI agent visiting a
> website hits the very same problem, just with a different pile to read — not
> files, but **tool descriptions**. Same trap, so use the same trick on the tools.

That's the whole seed of `webmcp-verified`. It's the ICM's "don't make it read
everything" idea, moved from *files* to *tools*.

[^icm]: *Interpretable Context Methodology: Folder Structure as Agentic
Architecture*, Jake Van Clief and David McDermott, 2026 (arXiv:2603.16021 — arXiv
is a free online library where researchers post papers).

---

## 3. How it works, under the hood

The project gives a developer three promises. Let's take them one at a time, each
with a real-world analogy.

### Promise 1: Grounded, not invented (the vending-machine rule)

A **vending machine** can only give you what's actually loaded inside it. Press a
button for a candy bar it doesn't stock, and it won't invent one — it just tells
you it's unavailable.

`webmcp-verified` makes a website's tool behave like that vending machine. The
developer declares two things:

- a **source** — the real data (a price list, a catalog, an inventory), and
- a **resolve** step — a small piece of the developer's own code that looks up an
  answer *in that source*.

When the AI asks the tool a question, the tool runs `resolve` against the source
and hands back the result. If the answer isn't in the source, the tool returns a
declared **fallback** ("I can't quote that — book a diagnostic instead"), *not* a
guessed number. The AI never gets to author the value; it only supplies the
question.

**One real limit** (this project takes its own edges seriously): the developer
writes the look-up code themselves. If they deliberately choose to copy whatever
the AI typed straight into the answer, that copied text goes through — the toolkit
guarantees the answers *it* looks up from your data, but it can't stop a developer
who hand-wires the AI's own words back in. So the promise is "it won't invent a
value that's supposed to come from your data," not "it can never be wrong." We say
the accurate version.

### Promise 2: A receipt for every answer (the store-receipt rule)

When you buy something, you get a **receipt** — proof of exactly what changed
hands, so there's no argument later. Every answer this toolkit gives can emit a
receipt too: a record of the outcome, which source it came from, and a
**fingerprint** of exactly what was returned (a fixed-length code computed from the
text; the receipt keeps this fingerprint, not a second copy of the full answer).

Later, you can check an answer against its receipt: re-run the fingerprint on the
answer, and if even one character was changed, the codes won't match — and you'll
know. That's the difference between "we think the AI said the right thing" and
"here is the record, and here is proof it wasn't altered." (Straight talk: this
fingerprint proves the text is *unchanged*; it's tamper-**evidence**, not a
bank-grade digital signature. If you need courtroom-grade proof you can upgrade it
— the docs say exactly how.)

### Promise 3: Cheap for the AI (the restaurant-menu rule)

Imagine a restaurant that, before you could order, forced you to read the full
ingredient list of all fifty dishes. Exhausting, and you only wanted one. A good
restaurant hands you a **short menu** — just dish names — and brings the detailed
description only for the dish you actually pick.

That's what this toolkit does with tools. Instead of making the AI read every
tool's full description up front, it offers:

- a **lean manifest** — a one-line summary per tool (the short menu), and
- a **describe step** — the full details for a tool, fetched only when the AI is
  actually interested (the detailed dish description on request).

The AI pays tokens for the short menu plus the *one* full description it needs —
instead of every full description for every tool. That's the ICM's "don't read
everything" idea, turned into money saved.

---

## 4. The results (measured, with the fine print attached)

Claims are cheap, so this project measures. In an illustrative test set-up of
**12 tools** (a "set-up" here just means a sample website offering that many
tools to an AI):

- Reading the tools the old way ("here's every tool's full description up front")
  costs about **1,340 tokens**.
- Reading them the lean way (short menu + full detail only for the one used)
  costs about **443 tokens**.
- That's roughly **67% fewer tokens** just to choose a tool — and the exact
  figure is pinned by an automated **test** (a tiny extra program that checks the
  main one still does what it claims and shouts if it doesn't), so it can't
  silently drift.

**The fine print, because it matters:**

- The 12-tool number is *illustrative*, not universal. How big the saving is
  depends on how many tools go unused and how wordy their descriptions are — the
  more tools the AI *doesn't* end up reading in full, the more it saves.
- The token counter is a fast *estimate* (about 4 characters per token), not a
  perfect one, so treat the absolute numbers (1,340 / 443) as approximate. The
  *percentage* is more trustworthy than the raw counts, because the same estimate
  is used on both sides and any error cancels out.
- This lean approach **only wins when there are several tools**. With just one
  tool, the "short menu then ask for detail" round-trip actually costs a little
  *more*. The code computes the exact crossover — for this set it's **2 tools** —
  and reports it plainly instead of hiding it.
- It counts *tokens*, not *quality*. Fewer tokens to choose is the claim; it does
  not claim to make the AI smarter.

There are also **50 automated tests** that run in a couple of seconds and check
every promise above — grounding, the fallback, the receipt, the menus, the token
counts. Anyone can download a copy of the project and run them.

---

## 5. Where this fits in the bigger world

*If you're just curious, you can skim this section — it's mostly names other
builders will recognize.*

| Name | What it is | Usable today? |
|---|---|---|
| **WebMCP** | a draft web standard (from the W3C, the group that standardizes the web) letting a website offer tools to an AI | Early — mostly switched off by default in browsers; only developers can turn it on |
| **MCP** | the general standard for giving AI models tools; WebMCP is basically MCP for inside a web page | Yes, widely used |
| **ACP** | the standard behind features like buying inside ChatGPT | Yes — already live, moving real money |
| **MCP-B** | an existing, general-purpose toolkit for making a website AI-ready | Yes |

`webmcp-verified` speaks WebMCP and maps onto the others. It is **not** trying to
replace a general toolkit like MCP-B — it's a thin *layer you add on top* for the
three promises above: grounding, a receipt, and lower token cost. The short
version: other tools help a website *offer* tools to an AI; this one makes the
answers those tools give **trustworthy and cheap**.

---

## 6. What it does NOT do

A tool worth trusting is as clear about its edges as its strengths. This one does
**not**:

- **Make your data correct.** It guarantees the answer came from your source. If
  your source has the wrong price in it, you'll get the wrong price — faithfully.
  Keeping the data right is still your job.
- **Stop a developer from echoing AI text on purpose.** See the limit in
  Promise 1. It grounds what it looks up; it can't bless words a developer wires
  back in by hand.
- **Provide bank-grade cryptographic proof.** The receipt's fingerprint is
  tamper-evidence, not a digital signature (upgradeable if you need more).
- **Work everywhere today.** WebMCP is early and mostly turned off by default in
  browsers. This is deliberately built for where the web is *going*, while today's
  transaction money flows through the already-live ACP world it also maps onto.
- **Claim to be the only or the first.** It claims to be honest and measured.
  Those are different, and the second is the one worth trusting.

---

## 7. Why an AI would choose it (the twist)

Here's the unusual part. This tool's most important *reader* isn't a human — it's
another AI. When an AI agent lands on a website and has to pick a tool, it prefers
tools that are **cheap to read** and **predictable to use**. A `webmcp-verified`
tool is both: it costs fewer tokens to consider, and it always returns a clean,
labeled answer or a declared fallback — never a crash, never a surprise. In a
world where AIs choose which tools to call, being the tool that's *easy on the AI*
is how you get chosen. This project is, in a real sense, designed to be
recommended by machines.

---

## 8. Glossary

- **AI agent** — a program that uses an AI model to take actions for someone
  (look up a price, book a slot), not just chat.
- **Tool** — one named action a website makes available for an AI to call, with a
  short description, e.g. "look up a price" or "book a slot."
- **Token** — the unit AIs read and write in, roughly ¾ of a word. Whoever runs
  the AI pays per token.
- **Hallucination** — when an AI states something made-up as if it were fact.
- **Grounding** — forcing an answer to come from a specific real source instead
  of the AI's guess.
- **Source** — the real data a tool draws from (price list, catalog, inventory).
- **resolve** — the small piece of developer code that looks an answer up in the
  source.
- **Fallback** — the safe, declared response when the answer isn't in the source
  ("can't quote that") instead of a guess.
- **Manifest** — the short, one-line-per-tool menu an AI reads to choose a tool.
- **Receipt / fingerprint** — a tamper-evident record of exactly what a tool
  answered.
- **Test** — a tiny extra program that automatically checks the main one still
  does what it claims.
- **Layered context loading** — the ICM's idea of loading only the information a
  step needs, instead of everything at once (the community nickname is
  "progressive disclosure").
- **WebMCP / MCP / ACP** — standards for letting AIs use tools (see section 5).
- **ICM** — Interpretable Context Methodology, the paper this project builds on.

---

## 9. Try it

*This part's for developers — if that's not you yet, no worries, you've already
got the whole idea.* (These commands need [Node](https://nodejs.org) and Git
installed.)

```bash
git clone https://github.com/xnfinite/webmcp-verified
cd webmcp-verified
node test/smoke.mjs        # watch all the promises get checked, in ~2 seconds
node scripts/discovery.mjs # see the token measurement for yourself
```

Everything above is either running code you can execute or a claim a test checks.
That's the point: in a field full of confident guessing, this is a small tool that
tries very hard to only say what it can show.

*Free and open source (MIT). Built by Nightflow Systems, standing on the ICM work
of Van Clief and McDermott.*
