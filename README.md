# Astrelle

A browser built on Firefox ESR, with our own interface on top.

Builds happen on GitHub's servers, not on a home connection: Mozilla's source is about 800 MB
per version. Every day a GitHub Action checks for a new Firefox ESR security release and, when
there is one, builds it with our changes and publishes it under Releases. To build our own
changes, start the Build workflow by hand: `gh workflow run build.yml`. One build takes about
three hours. The repository is public because GitHub gives public repositories larger build
machines (4 cores, 16 GB): the private ones (2 cores, 7.7 GB) can't build Firefox.

| Path | What it is |
| --- | --- |
| `release.env` | Which ESR line we follow, and the program's names |
| `mozconfig` | Firefox build options |
| `overlay/` | Our own files, copied into Firefox at the same paths |
| `patches/` | Changes to Firefox's own files, applied in name order |
| `scripts/prepare.sh` | Downloads and verifies the source, applies overlay and patches |
| `.github/workflows/build.yml` | The daily check and the build |

Once a year Mozilla starts a new ESR line: change `ESR_MAJOR` in `release.env` and re-check
every patch.
