module.exports = {
  extends: ['./base.js', 'plugin:n/recommended'],
  plugins: ['n'],
  rules: {
    'n/no-process-exit': 'off',
    'n/no-missing-import': 'off',
    'n/shebang': 'off'
  }
};
