<script lang="ts">
  export let label: string;
  export let options: readonly { value: string; label: string }[];
  export let value: string;
  export let onChange: (value: string) => void;

  let open = false;
  let root: HTMLDivElement;
  let trigger: HTMLButtonElement;
  let optionButtons: HTMLButtonElement[] = [];
  $: selected =
    options.find((option) => option.value === value)?.label ?? value;

  function close() {
    open = false;
    trigger?.focus();
  }
  function choose(next: string) {
    onChange(next);
    close();
  }
  function keydown(event: KeyboardEvent) {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      close();
    } else if (
      open &&
      ["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)
    ) {
      event.preventDefault();
      const current = optionButtons.indexOf(
        document.activeElement as HTMLButtonElement,
      );
      const next =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? options.length - 1
            : event.key === "ArrowDown"
              ? (current + 1) % options.length
              : (current - 1 + options.length) % options.length;
      optionButtons[next]?.focus();
    }
  }
</script>

<svelte:window
  onpointerdown={(event) => {
    if (open && !root?.contains(event.target as Node)) open = false;
  }}
/>
<div
  class="preference-field"
  bind:this={root}
  onkeydown={keydown}
  role="presentation"
>
  <span class="preference-label">{label}</span>
  <div class="preference-dropdown">
    <button
      bind:this={trigger}
      type="button"
      class="dropdown-trigger"
      aria-label={label}
      aria-expanded={open}
      aria-haspopup="listbox"
      onclick={() => {
        open = !open;
        if (open)
          requestAnimationFrame(() =>
            optionButtons[
              options.findIndex((option) => option.value === value)
            ]?.focus(),
          );
      }}
    >
      {selected}<span class="dropdown-chevron" aria-hidden="true"></span>
    </button>
    {#if open}
      <div class="dropdown-options" role="listbox" aria-label={label}>
        {#each options as option, position (option.value)}
          <button
            bind:this={optionButtons[position]}
            type="button"
            role="option"
            aria-selected={value === option.value}
            onclick={() => choose(option.value)}>{option.label}</button
          >
        {/each}
      </div>
    {/if}
  </div>
</div>
