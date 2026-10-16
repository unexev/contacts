# Product

## Register

product

## Users

People who manage many personal and professional contacts and need to look up, complete and keep accurate records for each person: names, phones, emails, identity documents, birthdays, relationships, organizations. Spanish-speaking (Ecuador context), often on a phone, often in quick lookups between other tasks. Each user has a private account; the product is offered to third parties as a SaaS.

## Product Purpose

A contact management app (Go API, SvelteKit web app, PostgreSQL) where each contact is a rich record, not just a name and number. Success is finding a person and the exact piece of data needed in a few seconds, and keeping records complete without friction.

## Brand Personality

Efficient, precise, trustworthy: a working tool. Voice is plain and direct Spanish, short labels, no marketing tone. The interface stays out of the way and rewards repeated use.

## Anti-references

- Heavy corporate CRM (Salesforce style): endless forms, deep menus, visual noise.
- Generic template SaaS: identical card grids, gradients, hero metrics, the default AI look.
- Decorative or childish apps: illustrations, emoji and animation that get in the way of work.

## Design Principles

1. Speed to the answer: the most common lookups (phone, document number, birthday) are reachable in one or two taps.
2. Density with clarity: show more per screen for power users without crowding; hierarchy does the work, not decoration.
3. Mobile first, desktop capable: thumb-reachable navigation and large touch targets; wider screens add room, not new patterns.
4. Respect sensitive data: identity documents and bank details look calm and deliberate, never playful.
5. Feedback that mirrors the interface: loading, empty and error states reuse the real layout so nothing jumps or feels generic.

## Accessibility & Inclusion

WCAG AA as the baseline (4.5:1 body contrast, visible focus, keyboard navigation) plus support for enlarged reading: respect system text scaling, generous touch targets, and `prefers-reduced-motion` for all animation. Light and dark themes both meet contrast requirements.
