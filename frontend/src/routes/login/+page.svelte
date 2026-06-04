<script lang="ts">
  import { goto } from '$app/navigation';
  import { pb } from '$lib/pb';
  import { toasts, theme } from '$lib/stores';
  import ThemeToggle from '$lib/components/ThemeToggle.svelte';

  let email = '';
  let password = '';
  let loading = false;
  let oauthLoading = false;
  let error = '';

  // ── MFA (email OTP) state ────────────────────────────────────────────────────
  // After a correct password (or Google sign-in), PocketBase returns a 401 with an
  // mfaId — the user must then complete a second factor (email OTP) to get a token.
  let mfaId = '';
  let otpId = '';
  let otpCode = '';
  let otpEmail = ''; // email the code was sent to
  let otpLoading = false;
  let resendCooldown = 0;
  let cooldownTimer: ReturnType<typeof setInterval>;

  function getMfaId(e: unknown): string {
    return (e as { response?: { mfaId?: string } })?.response?.mfaId ?? '';
  }

  async function startOtpStep(targetEmail: string) {
    otpEmail = targetEmail;
    otpCode = '';
    error = '';
    try {
      const req = await pb.collection('users').requestOTP(targetEmail);
      otpId = req.otpId;
      startCooldown();
    } catch {
      error = 'Could not send the verification code. Please try again.';
    }
  }

  function startCooldown() {
    resendCooldown = 30;
    clearInterval(cooldownTimer);
    cooldownTimer = setInterval(() => {
      resendCooldown -= 1;
      if (resendCooldown <= 0) clearInterval(cooldownTimer);
    }, 1000);
  }

  async function verifyOtp() {
    if (!otpCode.trim()) {
      error = 'Enter the code from your email.';
      return;
    }
    otpLoading = true;
    error = '';
    try {
      await pb.collection('users').authWithOTP(otpId, otpCode.trim(), { mfaId });
      await goto('/contacts');
      toasts.success('Welcome back!');
    } catch {
      error = 'Invalid or expired code. Please try again.';
    } finally {
      otpLoading = false;
    }
  }

  function cancelOtp() {
    mfaId = '';
    otpId = '';
    otpCode = '';
    otpEmail = '';
    error = '';
    clearInterval(cooldownTimer);
  }

  // ── Primary auth methods ─────────────────────────────────────────────────────
  async function login() {
    if (!email || !password) {
      error = 'Please enter your email and password.';
      return;
    }
    loading = true;
    error = '';
    try {
      await pb.collection('users').authWithPassword(email, password);
      await goto('/contacts');
      toasts.success('Welcome back!');
    } catch (e: unknown) {
      const id = getMfaId(e);
      if (id) {
        // Password was correct — second factor required.
        mfaId = id;
        await startOtpStep(email);
      } else {
        error = 'Invalid email or password.';
      }
    } finally {
      loading = false;
    }
  }

  async function loginWithGoogle() {
    oauthLoading = true;
    error = '';
    try {
      await pb.collection('users').authWithOAuth2({ provider: 'google' });
      await goto('/contacts');
      toasts.success('Welcome back!');
    } catch (e: unknown) {
      const id = getMfaId(e);
      if (id) {
        // Google sign-in succeeded — second factor required.
        mfaId = id;
        if (email) {
          await startOtpStep(email);
        }
        // If no email typed yet, the OTP screen asks for it.
      } else {
        const msg = (e as { response?: { message?: string } })?.response?.message ?? '';
        if (msg.toLowerCase().includes('fossunited')) {
          error = 'Only @fossunited.org Google accounts are allowed.';
        } else if (msg) {
          error = msg;
        } else {
          error = 'Google sign-in failed or was cancelled.';
        }
      }
    } finally {
      oauthLoading = false;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') login();
  }

  function handleOtpKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      if (otpId) verifyOtp();
      else if (otpEmail) startOtpStep(otpEmail);
    }
  }
</script>

<svelte:head>
  <title>Login · Rolodex</title>
</svelte:head>

<div class="min-h-screen bg-white dark:bg-neutral-950 flex flex-col">
  <!-- Top bar -->
  <div class="flex justify-between items-center px-6 py-4">
    <div class="flex items-center gap-3">
      <img src="/logo-black.svg" alt="FOSS United" class="h-6 dark:hidden" />
      <img src="/logo-white.svg" alt="FOSS United" class="h-6 hidden dark:block" />
      <span class="text-xs text-neutral-400 dark:text-neutral-500 font-medium tracking-widest uppercase">Rolodex</span>
    </div>
    <ThemeToggle />
  </div>

  <!-- Main content -->
  <div class="flex-1 flex items-center justify-center px-4">
    <div class="w-full max-w-sm animate-fade-in">
      {#if mfaId}
        <!-- ── Step 2: email OTP ─────────────────────────────────────────────── -->
        <div class="mb-8">
          <h1 class="text-2xl font-semibold text-neutral-900 dark:text-neutral-50 tracking-tight">
            Verify it's you
          </h1>
          <p class="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            {#if otpId}
              We sent a 6-digit code to <span class="font-medium text-neutral-700 dark:text-neutral-300">{otpEmail}</span>
            {:else}
              Enter your email to receive a verification code
            {/if}
          </p>
        </div>

        <div class="space-y-4">
          {#if !otpId}
            <!-- OAuth path where we don't know the email yet -->
            <div>
              <label for="otp-email" class="label">Email</label>
              <input
                id="otp-email"
                type="email"
                bind:value={otpEmail}
                on:keydown={handleOtpKeydown}
                class="input"
                placeholder="you@fossunited.org"
                autocomplete="email"
              />
            </div>
            {#if error}
              <p class="text-sm text-red-600 dark:text-red-400">{error}</p>
            {/if}
            <button
              on:click={() => startOtpStep(otpEmail)}
              disabled={!otpEmail}
              class="btn-primary w-full py-2.5"
            >
              Send code
            </button>
          {:else}
            <div>
              <label for="otp-code" class="label">Verification code</label>
              <input
                id="otp-code"
                type="text"
                inputmode="numeric"
                maxlength="6"
                bind:value={otpCode}
                on:keydown={handleOtpKeydown}
                class="input text-center text-lg tracking-[0.5em] font-mono"
                placeholder="······"
                autocomplete="one-time-code"
                disabled={otpLoading}
              />
            </div>

            {#if error}
              <p class="text-sm text-red-600 dark:text-red-400 flex items-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/>
                </svg>
                {error}
              </p>
            {/if}

            <button
              on:click={verifyOtp}
              disabled={otpLoading || otpCode.length < 6}
              class="btn-primary w-full py-2.5"
            >
              {#if otpLoading}
                <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Verifying…
              {:else}
                Verify & sign in
              {/if}
            </button>

            <div class="flex items-center justify-between text-xs">
              <button
                on:click={() => startOtpStep(otpEmail)}
                disabled={resendCooldown > 0}
                class="text-neutral-500 dark:text-neutral-400 hover:text-accent dark:hover:text-accent-dark disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
              </button>
              <button on:click={cancelOtp} class="text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200">
                Back to login
              </button>
            </div>
          {/if}
        </div>
      {:else}
        <!-- ── Step 1: credentials ───────────────────────────────────────────── -->
        <div class="mb-8">
          <h1 class="text-2xl font-semibold text-neutral-900 dark:text-neutral-50 tracking-tight">
            Sign in
          </h1>
          <p class="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            Internal access only · FOSS United staff
          </p>
        </div>

        <!-- Form -->
        <div class="space-y-4">
          <div>
            <label for="email" class="label">Email</label>
            <input
              id="email"
              type="email"
              bind:value={email}
              on:keydown={handleKeydown}
              class="input"
              placeholder="you@fossunited.org"
              autocomplete="email"
              disabled={loading}
            />
          </div>

          <div>
            <label for="password" class="label">Password</label>
            <input
              id="password"
              type="password"
              bind:value={password}
              on:keydown={handleKeydown}
              class="input"
              placeholder="••••••••"
              autocomplete="current-password"
              disabled={loading}
            />
          </div>

          {#if error}
            <p class="text-sm text-red-600 dark:text-red-400 flex items-center gap-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/>
              </svg>
              {error}
            </p>
          {/if}

          <button
            on:click={login}
            disabled={loading || oauthLoading}
            class="btn-primary w-full py-2.5 mt-2"
          >
            {#if loading}
              <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              Signing in…
            {:else}
              Sign in
            {/if}
          </button>

          <div class="flex items-center gap-3 mt-2">
            <div class="flex-1 h-px bg-neutral-200 dark:bg-neutral-800"></div>
            <span class="text-xs text-neutral-400 dark:text-neutral-600">or</span>
            <div class="flex-1 h-px bg-neutral-200 dark:bg-neutral-800"></div>
          </div>

          <button
            on:click={loginWithGoogle}
            disabled={loading || oauthLoading}
            class="btn-secondary w-full py-2.5 gap-3"
          >
            {#if oauthLoading}
              <div class="w-4 h-4 border-2 border-neutral-300 border-t-neutral-600 dark:border-neutral-600 dark:border-t-neutral-300 rounded-full animate-spin"></div>
              Connecting…
            {:else}
              <!-- Google icon -->
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 48 48">
                <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917"/>
                <path fill="#FF3D00" d="m6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691"/>
                <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44"/>
                <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917"/>
              </svg>
              Sign in with Google
            {/if}
          </button>
        </div>

        <!-- Footer note -->
        <p class="text-xs text-neutral-400 dark:text-neutral-600 text-center mt-8">
          Google sign-in is restricted to @fossunited.org accounts.
        </p>
      {/if}
    </div>
  </div>
</div>
