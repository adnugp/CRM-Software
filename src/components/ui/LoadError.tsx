import React from 'react';

/** Shown instead of "No … found" when a list couldn't be loaded (offline or no access). */
const LoadError: React.FC<{ what: string }> = ({ what }) => (
  <span role="alert" className="text-destructive">
    Couldn't load {what}. Check your connection and refresh the page.
  </span>
);

export default LoadError;
