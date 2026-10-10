import {
  AppState,
  Platform,
} from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';

import 'react-native-url-polyfill/auto';

import {
  createClient,
} from '@supabase/supabase-js';

const SUPABASE_URL =
  String(
    process.env.EXPO_PUBLIC_SUPABASE_URL
    || ''
  ).trim();

const SUPABASE_PUBLISHABLE_KEY =
  String(
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    || ''
  ).trim();

export const getSupabaseConfiguration = () => {
  const missing = [];

  if (!SUPABASE_URL) {
    missing.push(
      'EXPO_PUBLIC_SUPABASE_URL'
    );
  }

  if (!SUPABASE_PUBLISHABLE_KEY) {
    missing.push(
      'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY'
    );
  }

  return {
    configured:
      missing.length === 0,

    missing,
  };
};

let supabaseClient =
  null;

let authLifecycleBound =
  false;

const bindAuthLifecycle =
  (
    client
  ) => {
    if (
      !client
      || Platform.OS === 'web'
      || authLifecycleBound
    ) {
      return;
    }

    authLifecycleBound =
      true;

    const applyAppState =
      (
        state
      ) => {
        if (
          state === 'active'
        ) {
          client.auth.startAutoRefresh();

          return;
        }

        client.auth.stopAutoRefresh();
      };

    applyAppState(
      AppState.currentState
    );

    AppState.addEventListener(
      'change',
      applyAppState
    );
  };

export const getSupabaseClient =
  () => {
    const configuration =
      getSupabaseConfiguration();

    if (
      !configuration.configured
    ) {
      return null;
    }

    if (
      !supabaseClient
    ) {
      supabaseClient =
        createClient(
          SUPABASE_URL,
          SUPABASE_PUBLISHABLE_KEY,
          {
            auth: {
              storage:
                AsyncStorage,

              autoRefreshToken:
                true,

              persistSession:
                true,

              detectSessionInUrl:
                false,
            },
          }
        );

      bindAuthLifecycle(
        supabaseClient
      );
    }

    return supabaseClient;
  };
