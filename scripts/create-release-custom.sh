#!/bin/bash

# Create custom version tag, auto commit and push to remote repo

# Check if auto commit is needed (second parameter is auto-commit)
AUTO_COMMIT=false
if [ "$2" = "auto-commit" ]; then
  AUTO_COMMIT=true
fi

if [ "$1" ]; then
  VERSION=$1
  
  # Auto commit if needed
  if [ "$AUTO_COMMIT" = true ]; then
    echo "Performing auto commit..."
    git add .
    git commit -m "Release v$VERSION" || echo "No changes to commit"
  fi
  
  echo "Creating tag v$VERSION"
  git tag -d v$VERSION 2>/dev/null || true
  git tag v$VERSION
  
  echo "Pushing to remote repo..."
  git push origin HEAD
  git push origin v$VERSION -f
  
  echo "Done: Created tag v$VERSION and pushed to remote repo"
else
  echo "Please provide version number, example: npm run create-release:custom -- 0.52.3"
  exit 1
fi