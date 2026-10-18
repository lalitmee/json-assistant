<script lang="ts">
  export let label: string;
  export let options: readonly {
    value: string;
    label: string;
    icon?: "computer" | "dark_mode" | "light_mode";
  }[];
  export let value: string;
  export let onChange: (value: string) => void;
  export let className = "";

  $: index = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );

  function navigate(event: KeyboardEvent, position: number) {
    const next =
      event.key === "ArrowRight"
        ? position + 1
        : event.key === "ArrowLeft"
          ? position - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? options.length - 1
              : -1;
    if (next < 0 && event.key !== "ArrowLeft") return;
    if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const target = (next + options.length) % options.length;
    onChange(options[target].value);
    (event.currentTarget as HTMLElement).parentElement
      ?.querySelectorAll("button")
      [target]?.focus();
  }
</script>

<div
  class={className ? `segmented-control ${className}` : "segmented-control"}
  role="group"
  aria-label={label}
  style={`--count: ${options.length}; --index: ${index}`}
>
  <span class="segment-indicator" aria-hidden="true"></span>
  {#each options as option, position (option.value)}
    <button
      type="button"
      class:icon-segment={option.icon}
      aria-label={option.icon ? option.label : undefined}
      title={option.icon ? option.label : undefined}
      aria-pressed={value === option.value}
      onclick={() => onChange(option.value)}
      onkeydown={(event) => navigate(event, position)}
    >
      {#if option.icon}
        <span
          class="material-icon"
          data-material-icon={option.icon}
          aria-hidden="true"
          style={`--material-icon: url("/icons/material/${option.icon}.svg")`}
        ></span>
      {:else}
        {option.label}
      {/if}
    </button>
  {/each}
</div>
