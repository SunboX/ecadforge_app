# ECAD Forge 1.13.32

Version 1.13.32 restores valid Altium documents served without unused padding
at the end of their OLE container and improves native schematic fidelity.

## Git project loading

- Updated `altium-toolkit` to 1.4.14.
- Public GitHub and GitLab project folders now retain `.PcbDoc` files when all
  declared OLE stream bytes exist but unused final-sector padding is absent.
- Truly truncated stream data and incomplete FAT, directory, or mini-FAT
  structures continue to fail with the existing corruption diagnostic.

## Verification

- Added synthetic regular-stream and mini-stream regressions in the owning
  toolkit, including truncation, surplus-chain, and structural-corruption
  cases.
- Verified a public 15.4 MB PCB document parses to 16,783 canonical elements.

## Schematic fidelity

- Restored patterned signal-harness trunks, open splitter geometry, connection
  dots, and non-overlapping harness-entry labels.
- Applied the existing ECAD Forge schematic palette to pin-bearing component
  bodies and contacts, including passive and connector symbols.
- Preserved the existing canvas frame, sheet border layout, and decorative
  source graphics.
