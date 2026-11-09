export default {
  extends: ['@commitlint/config-conventional'],
  // Body lines carry prose; their width is not part of the convention.
  rules: { 'body-max-line-length': [0] },
};
