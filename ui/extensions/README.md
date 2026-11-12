Add-ons built into Aether, installed into each new profile on first run
(`scripts/install_ui.sh` copies them to `distribution/extensions/`). Each file is named
after the add-on's ID.

- `sip@osama.local.xpi`: Sip, the data saver, built from the Sip project with
  `python3 tools/build.py` (its `dist/sip.xpi`).
