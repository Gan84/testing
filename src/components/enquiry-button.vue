<template>
  <div class="tcs-enquiry-modal">
    <router-link :to="{name: 'enquiry-modal'}" class="tcs-enquiry-button">
      {{ $root.get_text('enquiry_button') }}
    </router-link>
    <router-view></router-view>
  </div>
</template>

<script>
export default {}
</script>
