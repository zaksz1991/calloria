# CALLORIA v6.79 — Mobile assessment viewport

## Problem addressed

The recruitment screen can be taller than a phone viewport, while its fixed Continue/Submit dock occupies the bottom edge. A fixed dock is useful because the candidate can still navigate without returning to the end of the page, but the document must reserve the dock's real occupied space. A fixed padding guess is unreliable when safe-area insets, browser chrome, orientation or the dock's own text height changes.

## Behaviour

The mobile UI guard measures the dock's rendered height and computed bottom position. It writes their combined clearance to a CSS custom property and recalculates it when the dock resizes or the visual viewport changes. Assessment content and scroll targets use that measured clearance, keeping the final option and final review area reachable above the dock.

On phone-sized layouts, the duplicate progress sidebar is hidden because the main question card already shows its section, question count and progress bar. The question, practical-call customer strip, response cards, save/exit control and final review remain available. Short portrait devices use denser spacing and 44-pixel minimum answer targets; the page remains vertically scrollable rather than clipping content.

## Scope preserved

This is a presentation and viewport change. It does not change recruitment question content, answer choices, assessment scoring, security-breach rules, pass thresholds, draft save/resume data, the offer flow, agent operations or the 3D workplace.
