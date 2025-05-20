import { Meteor } from 'meteor/meteor';
import React, { Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import '../shared/methods';
import { Loading } from './common/components/loading';
import { UIProvider } from './common/components/ui-provider';
import { Routes } from './routes';

/**
 * This is the client-side entry point
 */
Meteor.startup(() => {
  document.documentElement.setAttribute('lang', 'en');
  const container = document.getElementById('react-target');
  const root = createRoot(container);
  root.render(
    <UIProvider>
      <Suspense fallback={<Loading />}>
        <Routes />
      </Suspense>
    </UIProvider>
  );
});
console.log("--> (main.jsx-Line: 13)\n Meteor: ", Meteor, __webpack_require__);
