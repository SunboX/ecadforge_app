# ECAD Forge 1.13.26

Version 1.13.26 extends hosted project loading so public GitHub and GitLab
project links can open a supported ECAD design without first locating an
individual file.

## Hosted project loading

- A public project homepage derives its default branch from GitHub or GitLab
  project metadata before the app loads the project root.
- An explicit root-tree URL is accepted alongside existing file and folder
  URLs, so a hosted project can be opened from its visible repository root.
- Existing blob and raw file URLs continue to load their selected file.

## Verification and privacy

- Regression coverage verifies project-home default-branch discovery and
  explicit root-tree resolution for supported GitHub and GitLab hosts.
- Downloaded content continues to be parsed locally in the browser. The app
  keeps its local browser parsing behavior and does not send project contents
  or source URLs to ECAD Forge services.
