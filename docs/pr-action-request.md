# PR action request workflow

Use this workflow when you want an idea turned into a GitHub issue and then handled by a pull request.

## How to request work

1. Go to **Issues** in GitHub.
2. Choose **New issue**.
3. Select **PR action request**.
4. Fill in the goal, reason, acceptance criteria, and area of work.
5. Submit the issue.

The `Issue PR Action Request` workflow automatically marks matching issues with `needs-pr` and `triage`, then comments with the next steps for opening a linked pull request.

## How to open the pull request

1. Create a branch for the issue.
2. Make the code or documentation change.
3. Open a pull request using the included template.
4. Put `Closes #ISSUE_NUMBER` in the **Linked issue** section.
5. Add test results and a screenshot if the website changed visually.

## Example issue title

```text
[PR Action]: Add sponsor rate card to the advertisement preview section
```

## Example acceptance criteria

```text
- The website shows three sponsor package prices.
- Each package includes a call-to-action button.
- README explains how to edit the package names and prices.
- npm test passes.
```
