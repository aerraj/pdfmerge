// Local ESLint rule: a .tsx module may declare at most one top-level React component
// (a PascalCase function or arrow function). Enforces the "one React component per file"
// convention from AGENTS.md without depending on eslint-plugin-react.

/** @param {import('estree').Node | null | undefined} node */
function isFunctionLike(node) {
  return (
    !!node &&
    (node.type === 'FunctionDeclaration' ||
      node.type === 'FunctionExpression' ||
      node.type === 'ArrowFunctionExpression')
  );
}

/** @param {string} name */
function isComponentName(name) {
  return /^[A-Z][A-Za-z0-9]*$/.test(name);
}

/** @type {import('eslint').Rule.RuleModule} */
export const oneComponentPerFile = {
  meta: {
    type: 'suggestion',
    docs: { description: 'Allow at most one top-level React component per file' },
    schema: [],
    messages: {
      tooMany: 'Only one React component per file; "{{name}}" is a second component. Move it to its own file.',
    },
  },
  create(context) {
    /** @type {string[]} */
    const found = [];
    /** @param {import('estree').Node} node @param {string} name */
    const record = (node, name) => {
      if (!isComponentName(name)) return;
      found.push(name);
      if (found.length > 1) context.report({ node, messageId: 'tooMany', data: { name } });
    };
    /** @param {import('estree').Node} statement */
    const visit = (statement) => {
      const decl =
        statement.type === 'ExportNamedDeclaration' || statement.type === 'ExportDefaultDeclaration'
          ? statement.declaration
          : statement;
      if (!decl) return;
      if (decl.type === 'FunctionDeclaration' && decl.id) record(decl, decl.id.name);
      if (decl.type === 'VariableDeclaration') {
        for (const d of decl.declarations) {
          if (d.id.type !== 'Identifier') continue;
          let init = d.init;
          // memo(...) / forwardRef(...) wrappers
          if (init && init.type === 'CallExpression' && isFunctionLike(init.arguments[0])) init = init.arguments[0];
          if (isFunctionLike(init)) record(d, d.id.name);
        }
      }
    };
    return {
      Program(program) {
        for (const statement of program.body) visit(statement);
      },
    };
  },
};
