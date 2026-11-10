# BharatConnect

### Different Languages. One Conversation.

**BharatConnect** is an AI-powered, multilingual communication assistant
designed to help two people who speak different Indian languages
communicate more naturally through a shared conversation.

Instead of treating translation as a sequence of isolated sentences,
BharatConnect aims to preserve the speaker's intent, tone and
conversational context while supporting an ongoing two-way exchange.

> **Project focus:** intent- and tone-aware translation, context-aware
> speech correction, and continuous bidirectional conversation.

------------------------------------------------------------------------

## The problem

India's linguistic diversity can make everyday communication difficult
when people do not share a common language. A traveller may need to ask
for directions, speak with a shopkeeper, understand a bus conductor or
request help in a language they do not know.

A basic translation workflow can interrupt these interactions. Literal
translations may not preserve the intended tone, speech recognition can
mishear names or similar-sounding words, and users may have to restart
translation for every turn.

## Our solution

BharatConnect is designed to make cross-language conversations feel more
natural. A person speaks in their preferred language; the system
recognises the speech, interprets the intended message, translates it
for the other person and speaks the result aloud. The other person can
then reply in their own language.

The goal is not simply to translate words, but to help both people
understand one another throughout the conversation.

------------------------------------------------------------------------

## Core features

### 1. Intent- and tone-aware translation

Users can express what they want to communicate, including the language
and tone they prefer. BharatConnect aims to convey the request naturally
rather than translating it word for word.

**Example**

A user says:

> "Yaar, inse politely poochho ki bus stand kahan hai --- Kannada mein."

BharatConnect should convey the request as a polite, natural Kannada
question.

### 2. Context-aware speech correction

Speech recognition can confuse similar-sounding words, names or
mixed-language expressions. This is especially relevant when people
speak naturally in **Hinglish**, switching between Hindi and English
within the same sentence. BharatConnect uses the available audio
evidence and conversational context to identify likely recognition
errors before translation, while preserving the intended meaning of
code-switched speech.

When the intended word is uncertain, the system should ask for
clarification rather than silently guessing.

**Examples**

-   A speaker says, "Bhaiya, mujhe bus stand ka location bata do,"
    mixing Hindi and English. The system should recognise the
    mixed-language sentence instead of misinterpreting or dropping the
    English word.

-   If a person's name is unclear, BharatConnect can ask:

    > "Did you mean Ankit or Anjali?"

### 3. Continuous two-way conversation

BharatConnect is designed for an ongoing conversation between two people
speaking different languages. Each person's speech is translated for the
other, so they can continue talking without repeatedly restarting the
translation process.

**Example**

A traveller asks a bus conductor a question in Hindi. The conductor
replies in Kannada, and the traveller receives the translated response.
They can then ask a follow-up question and continue the exchange.

------------------------------------------------------------------------

## How it works

The intended speech pipeline brings together three stages:

1.  **Listen --- Speech-to-text (STT):** Capture speech and convert it
    into text.
2.  **Understand --- Context and intent processing:** Use an LLM to
    interpret the message, consider conversational context, preserve the
    requested tone and help resolve likely recognition errors.
3.  **Speak --- Text-to-speech (TTS):** Convert the translated message
    into spoken audio for the other participant.

The conversation then continues in the reverse direction when the other
participant replies.

### AI technology

The planned Gnani AI components are:

  Component                  Role
  -------------------------- -----------------------------------------
  **Gnani AI Prisma v3.0**   Speech-to-text
  **Gnani AI Evon**          LLM-based context and intent processing
  **Gnani AI Timbre v3.0**   Text-to-speech

Confirm the exact model versions and capabilities against the APIs
actually enabled in the project before describing them as deployed
features.

------------------------------------------------------------------------

## Designed for everyday conversations

Example situations include:

-   Asking a local vendor for a price in a polite tone.
-   Asking for directions to a bus stand or railway station.
-   Speaking with a bus conductor who uses a different language.
-   Asking follow-up questions without restarting the translation
    session.
-   Communicating in everyday Hinglish and other mixed-language speech,
    subject to the speech model's supported languages and measured
    performance.

## Project goals

-   Make communication across Indian languages easier.
-   Preserve meaning and tone instead of relying only on literal
    translation.
-   Reduce the impact of speech-recognition mistakes.
-   Support a smoother, continuous two-way conversation.
-   Evaluate performance using real conversational examples, including
    names, code-switching and follow-up questions.

## Evaluation

The system should be tested against a straightforward speech-to-text →
translation → text-to-speech baseline.

Useful measures include:

-   **Meaning preservation:** Does the translated message retain the
    speaker's intended meaning?
-   **Tone preservation:** Does the translation reflect the requested
    politeness or tone?
-   **Speech correction accuracy:** Are recognition errors corrected
    without introducing new ones?
-   **Conversation continuity:** Can both participants complete multiple
    turns without repeatedly restarting?
-   **Response time:** How long does each translated turn take?

These tests help establish where BharatConnect improves on a basic
translation workflow.

------------------------------------------------------------------------

## Project status and implementation

This README describes the BharatConnect concept and intended feature
set. Update this section with the repository's actual implementation
details before publishing:

-   Supported language pairs: **\[add verified languages\]**
-   Application platform: **\[add web / Android / iOS details\]**
-   Framework and libraries: **\[add verified stack\]**
-   API integration status: **\[add working integrations and
    versions\]**
-   Demo: **\[add demo link\]**

Do not list a model, language or feature as working until it has been
integrated and tested.

------------------------------------------------------------------------

## Vision

In a country where languages can change every 100 kilometres,
BharatConnect aims to be a constant that helps people connect wherever
they go.

**BharatConnect --- Different Languages. One Conversation.**
