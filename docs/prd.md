
# PRD — Kids Personalised Dictionary (MVP)

## 1. Vision

Build an engaging web application that helps children aged **4–10** expand their vocabulary through age-appropriate explanations and AI-generated visual stories. Every word a child learns becomes part of their personal learning journey through quizzes and games.

---

# 2. Problem Statement

Traditional dictionaries are written for adults and are difficult for young children to understand.

Children often:

* don't understand dictionary definitions
* lose interest after reading a definition
* forget newly learnt words
* lack engaging ways to reinforce vocabulary

Parents and teachers need a child-friendly dictionary that teaches rather than simply defines.

---

# 3. Goals

### Primary Goal

Help children understand new words in an engaging, memorable way.

### Secondary Goals

* Encourage daily vocabulary learning
* Reinforce retention through games
* Build a personalised vocabulary collection
* Reduce parents' need to explain every word

---

# 4. Target Users

### Primary

Children aged **4–10**

Subgroups:

* 4–6 years old
* 7–8 years old
* 9–10 years old

Each group receives different:

* vocabulary difficulty
* sentence complexity
* comic length
* quiz difficulty

### Secondary

Parents and teachers.

---

# 5. MVP Features

## 1. Word Lookup

User enters a word.

System displays:

* simplified definition
* pronunciation
* phonetic spelling
* examples
* synonyms

---

## 2. AI Comic Story

Each word generates a short comic.

MVP:

* multiple comic panels
* no narration
* illustrates the meaning visually

---

## 3. Personal Dictionary

Logged-in users can:

* save words
* view saved words
* remove saved words

---

## 4. Quiz

Generate multiple-choice questions using saved words.

Track:

* score
* attempts

---

## 5. Crossword

Generate crossword puzzles using saved words.

---

# 6. User Journey

```text
Home

↓

Search word

↓

Definition page

↓

Comic generated

↓

Save word

↓

Personal dictionary

↓

Quiz / Crossword

↓

Repeat
```

---

# 7. Functional Requirements

### Lookup

The system shall:

* validate the word
* retrieve dictionary data
* simplify definitions
* display pronunciation
* display examples
* display synonyms

---

### Story

The system shall:

* generate a comic story
* cache generated content
* reuse existing comics when available

---

### Dictionary

The system shall:

* allow authenticated users to save words
* prevent duplicate saves
* display saved words

---

### Quiz

The system shall:

* generate MCQs
* randomise question order
* show final score

---

### Crossword

The system shall:

* generate crossword layout
* validate answers

---

# 8. Non-functional Requirements

### Performance

Definition available within **2 seconds** if cached.

First-time generation:

Target < 15 seconds.

---

### Reliability

Graceful degradation.

Example:

Comic fails

↓

Still display definition.

---

### Scalability

Support future:

* narration
* flashcards
* spelling games
* teacher dashboard

without major redesign.

---

### Accessibility

Large buttons.

Large fonts.

Minimal reading.

Mobile friendly.

---

# 9. Out of Scope (MVP)

* Speech recognition
* Text-to-speech narration
* Teacher accounts
* Parent dashboard
* Spaced repetition
* Progress analytics
* Multiplayer games
* Multiple languages

---

# 10. Success Metrics

Technical

* 95% successful word lookups
* <2 s cached response
* <15 s first generation

User

* Average ≥3 words saved per user
* Average ≥5 quiz questions completed
* ≥80% comic generation success

---

# 11. High-Level Architecture

```text
User
 │
 ▼
Next.js Web App
 │
 ▼
Lookup Word Use Case
 │
 ├── Cache (Supabase)
 ├── Dictionary API
 ├── AI Definition Generator
 ├── Story Generator
 ├── Comic Generator
 └── Database
```

---

# 12. MVP Principles

1. **Definition first** — the child should never wait for a comic just to understand a word.
2. **Graceful degradation** — every AI step is optional; if one fails, the rest of the experience should still work.
3. **Cache aggressively** — generate once, reuse many times.
4. **Age-appropriate by design** — all generated content must match the selected age group.
5. **Specification before implementation** — every feature starts with a spec and acceptance criteria, then tests, then code.
