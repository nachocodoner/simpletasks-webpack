import { Migrations } from 'meteor/quave:migrations';
import { Meteor } from 'meteor/meteor';
import { WebApp } from 'meteor/webapp';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { onPageLoad } from 'meteor/server-render';

import './db/migrations';
import './tasks/tasks.publications';
import './tasks/tasks.methods';
import '../shared/methods';

/**
 * This is the server-side entry point
 */
Meteor.startup(() => {
  // Only use proxy middleware in development mode
  if (Meteor.isDevelopment) {
    // Target URL for the Rspack dev server
    const target = 'http://localhost:3005';

    // Proxy HMR websocket upgrade requests
    WebApp.connectHandlers.use('/ws',
      createProxyMiddleware( {
        target,
        ws: true,
        logLevel: 'debug'
      })
    );

    // Proxy all dev asset requests under the rspack prefix
    WebApp.connectHandlers.use('/__rspack__',
      createProxyMiddleware( {
        target, 
        changeOrigin: true,
        ws: true,
        // pathRewrite: { '^/__rspack__': '' },
        logLevel: 'debug'
      })
    );

    console.log('Rspack dev server proxy enabled');
  }

  Migrations.migrateTo('latest').catch((e) =>
    console.error('Error running migrations', e)
  );
});
