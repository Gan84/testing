<template>
  <div class="con-details">
    <div class="tcs-md" v-html="to_markdown(contractor.primary_description)"></div>

    <div class="tcs-attr" v-for="attr in contractor_extra.extra_attributes">
      <h3>{{ attr.name }}</h3>
      <p v-if="attr.type == 'text_short' || attr.type == 'text_extended'" class="tcs-md" v-html="to_markdown(attr.value)"></p>
      <p v-else>{{ attr.value }}</p>
    </div>

    <table class="tcs-skills" v-if="contractor_extra.skills">
      <caption>
        <h3>{{ $root.get_text('skills_label') }}</h3>
      </caption>
      <tr v-for="skill in contractor_extra.skills">
        <th scope="row">{{ skill.subject }}</th>
        <td>
        <span v-for="qual_level in filter_qual_levels(skill.qual_levels)">
          {{ qual_level }}
        </span>
        </td>
      </tr>
    </table>
  </div>
</template>

<script>
import {to_markdown} from '../utils'

export default {
  methods: {
    filter_qual_levels: (skills) => {
      if (skills.length <= 5) {
        return skills
      } else {
        return skills.slice(0, 2).concat(['...']).concat(skills.slice(-2))
      }
    },
    to_markdown: to_markdown
  },
  props: ['contractor'],
  computed: {
    contractor_extra () {
      return this.$root.contractors_extra[this.$route.params.link] || {}
    },
  }
}
</script>
