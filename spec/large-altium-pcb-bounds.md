# Large Altium PCB bounds

PCB primitive count must not turn coordinate measurements into function calls
with one argument per coordinate. The toolkit owns this behavior; the app
consumes its normal renderer API without rewriting the source model.

Acceptance criteria:

- A generated board containing 75,000 tracks renders every track and includes
  its extreme coordinates in the padded SVG viewBox.
- App renderer caching and bottom-side rendering continue to work for that
  board.
- Region bounds include valid outer contour and hole points with at least
  150,000 points, retaining existing invalid-point handling.
- Interaction bounds and native overlay bounds support the same contour size.
- Copper splitting accepts at least 150,000 primitives and retains existing
  layer selection and primitive grouping rules.
- Iterative numeric ranges retain native empty, NaN and signed-zero extrema.
- Fixtures are synthetic and contain no supplied document or session data.
