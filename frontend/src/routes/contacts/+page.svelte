<script lang="ts">
  import ContactsBrowser from '$lib/components/ContactsBrowser.svelte';
</script>

<svelte:head>
  <title>My Contacts · Rolodex</title>
</svelte:head>

<ContactsBrowser scope="mine" title="My Contacts" subtitle="contacts you've added or engaged with" />
