import {
  getSupabaseClient,
  getSupabaseConfiguration,
} from './supabaseClient';

let ensureSessionPromise =
  null;

const logAuth =
  (
    message,
    detail = ''
  ) => {
    console.log(
      '[Together][Supabase]',
      message,
      detail
    );
  };

const createFailure =
  (
    reason,
    error = null
  ) => ({
    ok: false,
    reason,
    userId: null,
    errorMessage:
      error?.message
        ? String(
            error.message
          )
        : '',
  });

const createAnonymousSession =
  async (
    client
  ) => {
    logAuth(
      'anonymous sign-in start'
    );

    const {
      data:
        anonymousData,
      error:
        anonymousError,
    } =
      await client.auth.signInAnonymously();

    if (
      anonymousError
    ) {
      logAuth(
        'anonymous sign-in failed',
        String(
          anonymousError.message
          || 'unknown'
        )
      );

      return createFailure(
        'anonymous_sign_in_failed',
        anonymousError
      );
    }

    const userId =
      anonymousData
        ?.user
        ?.id
      || anonymousData
        ?.session
        ?.user
        ?.id;

    if (
      !userId
    ) {
      logAuth(
        'anonymous sign-in incomplete',
        'user missing'
      );

      return createFailure(
        'anonymous_user_missing'
      );
    }

    logAuth(
      'anonymous sign-in success'
    );

    return {
      ok: true,
      reason:
        'anonymous_session_created',
      userId:
        String(
          userId
        ),
      created:
        true,
    };
  };

const clearStaleLocalSession =
  async (
    client
  ) => {
    logAuth(
      'stale session clear start'
    );

    try {
      const {
        error,
      } =
        await client.auth.signOut({
          scope:
            'local',
        });

      if (
        error
      ) {
        logAuth(
          'stale session clear failed',
          String(
            error.message
            || 'unknown'
          )
        );

        return false;
      }

      logAuth(
        'stale session clear success'
      );

      return true;
    } catch (
      error
    ) {
      logAuth(
        'stale session clear failed',
        String(
          error?.message
          || 'unknown'
        )
      );

      return false;
    }
  };

const validateExistingSession =
  async (
    client
  ) => {
    logAuth(
      'server user validation start'
    );

    try {
      const {
        data:
          userData,
        error:
          userError,
      } =
        await client.auth.getUser();

      const userId =
        userData
        ?.user
        ?.id;

      if (
        userError
        || !userId
      ) {
        logAuth(
          'server user validation failed',
          userError?.message
            ? String(
                userError.message
              )
            : 'user missing'
        );

        return {
          valid:
            false,
          userId:
            null,
        };
      }

      logAuth(
        'server user validation success'
      );

      return {
        valid:
          true,
        userId:
          String(
            userId
          ),
      };
    } catch (
      error
    ) {
      logAuth(
        'server user validation failed',
        String(
          error?.message
          || 'unknown'
        )
      );

      return {
        valid:
          false,
        userId:
          null,
      };
    }
  };

const ensureSession =
  async (
    client
  ) => {
    logAuth(
      'session check start'
    );

    const {
      data:
        sessionData,
      error:
        sessionError,
    } =
      await client.auth.getSession();

    if (
      sessionError
    ) {
      logAuth(
        'session check failed',
        String(
          sessionError.message
          || 'unknown'
        )
      );

      return createFailure(
        'session_read_failed',
        sessionError
      );
    }

    const existingUserId =
      sessionData
        ?.session
        ?.user
        ?.id;

    logAuth(
      'session check complete',
      existingUserId
        ? 'existing'
        : 'none'
    );

    if (
      existingUserId
    ) {
      const validation =
        await validateExistingSession(
          client
        );

      if (
        validation.valid
        && validation.userId
      ) {
        return {
          ok: true,
          reason:
            'existing_session',
          userId:
            validation.userId,
          created:
            false,
        };
      }

      logAuth(
        'stale local session detected'
      );

      await clearStaleLocalSession(
        client
      );
    }

    return createAnonymousSession(
      client
    );
  };

export const ensureTogetherAnonymousSession =
  (
    {
      client =
        getSupabaseClient(),
    } = {}
  ) => {
    if (
      !client
    ) {
      const configuration =
        getSupabaseConfiguration();

      logAuth(
        'client unavailable',
        configuration.missing.join(
          ','
        )
      );

      return Promise.resolve({
        ...createFailure(
          'not_configured'
        ),
        missing:
          configuration.missing,
      });
    }

    if (
      ensureSessionPromise
    ) {
      logAuth(
        'bootstrap reuse pending'
      );

      return ensureSessionPromise;
    }

    logAuth(
      'bootstrap begin'
    );

    ensureSessionPromise =
      ensureSession(
        client
      )
        .finally(
          () => {
            ensureSessionPromise =
              null;

            logAuth(
              'bootstrap finished'
            );
          }
        );

    return ensureSessionPromise;
  };
