<template>
  <div class="tcs-enquiry">
    <div class="tcs-submitted" v-if="submitted">
      <div v-if="ismodal" v-html="$root.get_text('enquiry_modal_submitted_thanks', {}, true)"></div>
      <div v-else v-html="$root.get_text('enquiry_submitted_thanks', {}, true)"></div>
    </div>
    <div v-else>
      <div v-if="contractor" class="tcs-centre" v-html="$root.get_text('contractor_enquiry', {contractor_name: contractor.name}, true)">
      </div>
      <div v-else class="tcs-centre" v-html="$root.get_text('enquiry', {}, true)">
      </div>
      <form class="tcs" @submit.prevent="submit">
        <div v-for="field in visible_fields">
          <tcs-input :field="field"></tcs-input>
        </div>

        <div :id="$root.grecaptcha_container_id" class="grecaptcha"></div>
        <div v-if="grecaptcha_missing" class="error-msg">
          {{ $root.get_text('grecaptcha_missing') }}
        </div>

        <div class="tcs-field tcs-submit">
          <button type="submit">
            {{ $root.get_text('submit_enquiry') }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script>
import input from './input.vue'
import {add_script} from '../utils'

export default {
  props: {
    contractor: {
      type: Object,
      default: null,
    },
    mode: {
      type: String,
      default: 'vanilla',
    },
  },
  components: {
    'tcs-input': input
  },
  computed: {
    visible_fields () {
      return this.$root.enquiry_form_info.visible || []
    },
    attribute_fields () {
      return this.$root.enquiry_form_info.attributes || []
    },
    ismodal () {
      return this.mode.indexOf('modal') > -1
    }
  },
  data: () => ({
    submitted: false,
    grecaptcha_missing: false,
  }),
  methods: {
    submit () {
      if (window.grecaptcha && !this.$root.enquiry_data.grecaptcha_response) {
        this.grecaptcha_missing = true
        return
      }

      if (this.contractor !== null) {
        this.$set(this.$root.enquiry_data, 'contractor', this.contractor.id)
      }
      this.$set(this.$root.enquiry_data, 'upstream_http_referrer', document.referrer)
      this.$root.submit_enquiry(this.submission_complete)
      this.$root.ga_event('enquiry-form', 'submitted', this.mode)
    },
    submission_complete () {
      this.submitted = true
    },
    /* istanbul ignore next */
    prepare_grecaptcha () {
      if (this.$root.grecaptcha_key === null) {
        this.$root.grecaptcha_callback('-')
        return
      }

      if (window.grecaptcha === undefined) {
        add_script('https://www.google.com/recaptcha/api.js?onload=_tcs_grecaptcha_loaded&render=explicit')
      } else {
        this.$root.render_grecaptcha()
      }
    }
  },
  created () {
    this.$root.get_enquiry()
    if (this.mode !== 'vanilla') {
      this.$root.ga_event('enquiry-form', 'loaded', this.mode)
    }
    setTimeout(this.prepare_grecaptcha, 50)
  },
}
</script>
