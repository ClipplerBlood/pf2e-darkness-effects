// SPDX-FileCopyrightText: 2022 Johannes Loher
//
// SPDX-License-Identifier: MIT

import { moduleID } from './const.js';

export function registerSettings() {
  // Register any custom module settings here
  game.settings.register(moduleID, 'delay', {
    name: 'pf2e-darkness-effects.settings.delay.name',
    hint: 'pf2e-darkness-effects.settings.delay.hint',
    scope: 'world',
    config: true,
    type: Number,
    default: 1000,
  });

  game.settings.register(moduleID, 'chatMessageAlert', {
    name: 'pf2e-darkness-effects.settings.chatMessageAlert.name',
    scope: 'world',
    config: true,
    type: String,
    choices: {
      off: 'Off',
      players: 'Players',
      both: 'GMs + Players',
      gm: 'GMs',
    },
    default: 'off',
  });

  game.settings.register(moduleID, 'overrideDimlyLit', {
    name: 'pf2e-darkness-effects.settings.overrideDimlyLit.name',
    hint: 'pf2e-darkness-effects.settings.overrideDimlyLit.hint',
    scope: 'client',
    config: true,
    type: String,
    default: '',
  });

  game.settings.register(moduleID, 'overrideInDarkness', {
    name: 'pf2e-darkness-effects.settings.overrideInDarkness.name',
    hint: 'pf2e-darkness-effects.settings.overrideInDarkness.hint',
    scope: 'client',
    config: true,
    type: String,
    default: '',
  });
}
