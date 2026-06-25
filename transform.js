module.exports = function(fileInfo, api) {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);

  const replacements = {
    dbGet: 'get',
    dbAll: 'all',
    dbRun: 'run'
  };

  for (const [funcName, methodName] of Object.entries(replacements)) {
    root.find(j.CallExpression, {
      callee: { name: funcName }
    }).forEach(path => {
      const args = path.node.arguments;
      if (args.length === 0) return; // invalid
      
      const sqlArg = args[0];
      const paramsArg = args.length > 1 ? args.slice(1) : [];

      // Create: db.prepare(sqlArg)
      const dbPrepareCall = j.callExpression(
        j.memberExpression(j.identifier('db'), j.identifier('prepare')),
        [sqlArg]
      );

      // Create: db.prepare(sqlArg).methodName(...paramsArg)
      const newCall = j.callExpression(
        j.memberExpression(dbPrepareCall, j.identifier(methodName)),
        paramsArg
      );

      j(path).replaceWith(newCall);
    });
  }

  // Find the import: const { ..., dbGet, dbAll, dbRun } = require('./database');
  // and replace them with `db` if not already imported.
  root.find(j.VariableDeclarator, {
    init: {
      type: 'CallExpression',
      callee: { name: 'require' }
    }
  }).forEach(path => {
    if (path.node.init.arguments[0].value === './database') {
      if (path.node.id.type === 'ObjectPattern') {
        const props = path.node.id.properties;
        let hasDb = false;
        const newProps = props.filter(p => {
          if (p.key.name === 'db') hasDb = true;
          return !['dbGet', 'dbAll', 'dbRun'].includes(p.key.name);
        });
        if (!hasDb) {
          newProps.push(j.property('init', j.identifier('db'), j.identifier('db')));
        }
        path.node.id.properties = newProps;
      }
    }
  });

  return root.toSource();
};
