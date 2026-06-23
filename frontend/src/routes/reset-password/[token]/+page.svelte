<script lang="ts">
  import { base } from '$app/paths';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { pb } from '$lib/pb';
  import { toasts } from '$lib/stores';
  import ThemeToggle from '$lib/components/ThemeToggle.svelte';

  let password = '';
  let passwordConfirm = '';
  let loading = false;
  let error = '';

  async function confirmReset() {
    if (password.length < 8) {
      error = 'Password must be at least 8 characters.';
      return;
    }
    if (password !== passwordConfirm) {
      error = 'Passwords do not match.';
      return;
    }
    loading = true;
    error = '';
    try {
      await pb.collection('users').confirmPasswordReset($page.params.token ?? '', password, passwordConfirm);
      toasts.success('Password updated — sign in with your new password.');
      await goto(`${base}/login`);
    } catch {
      error = 'This reset link is invalid or has expired. Request a new one from the login page.';
    } finally {
      loading = false;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') confirmReset();
  }
</script>

<svelte:head>
  <title>Reset password · Rolodex</title>
</svelte:head>

<div class="min-h-screen bg-white dark:bg-neutral-950 flex flex-col">
  <!-- Top bar -->
  <div class="flex justify-end items-center px-6 py-4">
    <ThemeToggle />
  </div>

  <!-- Main content -->
  <div class="flex-1 flex items-center justify-center px-4">
    <div class="w-full max-w-sm animate-fade-in">
      <!-- Brand -->
      <div class="flex items-center gap-3 mb-8">
        <img src="{base}/logo-black.svg" alt="FOSS United" class="h-8 dark:hidden" />
        <img src="{base}/logo-white.svg" alt="FOSS United" class="h-8 hidden dark:block" />
        <span class="text-sm text-neutral-400 dark:text-neutral-500 font-medium tracking-widest uppercase">Rolodex</span>
      </div>

      <div class="mb-8">
        <h1 class="text-2xl font-semibold text-neutral-900 dark:text-neutral-50 tracking-tight">
          Choose a new password
        </h1>
        <p class="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
          Minimum 8 characters.
        </p>
      </div>

      <div class="space-y-4">
        <div>
          <label for="new-password" class="label">New password</label>
          <input
            id="new-password"
            type="password"
            bind:value={password}
            on:keydown={handleKeydown}
            class="input"
            placeholder="••••••••"
            autocomplete="new-password"
            disabled={loading}
          />
        </div>

        <div>
          <label for="confirm-password" class="label">Confirm new password</label>
          <input
            id="confirm-password"
            type="password"
            bind:value={passwordConfirm}
            on:keydown={handleKeydown}
            class="input"
            placeholder="••••••••"
            autocomplete="new-password"
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
          on:click={confirmReset}
          disabled={loading || !password || !passwordConfirm}
          class="btn-primary w-full py-2.5"
        >
          {#if loading}
            <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            Updating…
          {:else}
            Update password
          {/if}
        </button>

        <a href="{base}/login" class="block text-center text-xs text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 py-1">
          Back to login
        </a>
      </div>
    </div>
  </div>
</div>
