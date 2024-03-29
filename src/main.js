import Raven from 'raven-js'
import RavenVue from 'raven-js/plugins/vue'
import Vue from 'vue'
import VueRouter from 'vue-router'
import app from './app'
import enquiry from './components/enquiry'
import enquiry_button from './components/enquiry-button'
import enquiry_modal from './components/enquiry-modal'
import grid from './components/grid'
import con_modal from './components/con-modal'
import {to_markdown, clean, auto_url_root, init_ga} from './utils'
import './main.scss'

const raven_config = {
  release: process.env.RELEASE,
  tags: {
    host: window.location.host,
  },
  shouldSendCallback: data => {
    // if no culprit this a message and came from socket
    const culprit = data.culprit || '/socket.js'
    const should_send = culprit.indexOf('/socket.js') > 0
    console.debug('sending raven error', should_send, data)
    return should_send
  }
}
Raven.config(process.env.RAVEN_DSN, raven_config).addPlugin(RavenVue, Vue).install()

Vue.use(VueRouter)

const ConfiguredVueRouter = config => {
  const routes = []
  const url_base = config.router_mode === 'history' ? config.url_root : '/'
  if (config.mode === 'grid') {
    routes.push(
      {
        path: url_base + ':type(s|q)?/:link(\\d+-[\\w-]+)?',
        name: 'index',
        component: grid,
        children: [
          {
            path: url_base + ':link(\\d+-[\\w-]+)',
            name: 'con-modal',
            component: con_modal,
          }
        ]
      }
    )
  } else if (config.mode === 'enquiry') {
    routes.push(
      {
        path: url_base,
        name: 'index',
        component: enquiry,
      },
    )
  } else if (config.mode === 'enquiry-modal') {
    routes.push(
      {
        path: url_base,
        name: 'index',
        component: enquiry_button,
        children: [
          {
            path: url_base + 'enquiry',
            name: 'enquiry-modal',
            component: enquiry_modal,
          }
        ]
      }
    )
  }
  console.debug('setting routes:', routes)
  return new VueRouter({
    mode: config.router_mode,
    routes: routes
  })
}

// TODO these need a consist prefix
const STRINGS = {
  skills_label: 'Skills',
  contractor_enquiry: 'Please enter your details below to enquire about tutoring with {contractor_name}.',
  enquiry: 'Please enter your details below and we will get in touch with you shortly.',
  contractor_enquiry_button: 'Contact {contractor_name}',
  contractor_details_button: 'Show Profile',
  submit_enquiry: 'Submit Enquiry',
  enquiry_submitted_thanks: 'Enquiry submitted, thank you.',
  enquiry_modal_submitted_thanks: 'Enquiry submitted, thank you.\n\nYou can now close this window.',
  enquiry_button: 'Get in touch',
  grecaptcha_missing: 'This captcha is required',
  required: ' (Required)',
  subject_filter: 'Filter by subject',
  subject_filter_summary_single: '{subject}: showing 1 result',
  subject_filter_summary_plural: '{subject}: showing {count} results',
}

const MODES = ['grid', 'enquiry', 'enquiry-modal']
const ROUTER_MODES = ['hash', 'history']

module.exports = function (public_key, config) {
  config = config || {}
  Raven.setExtraContext({
    public_key: public_key,
    config: config,
  })

  if (!config.console) {
    config.console = console
    if (!window.localStorage.tcs_enable_debug) {
      if (!window.tcs_debug_log) {
        window.tcs_debug_log = []
      }
      console.debug = function () {
        window.tcs_debug_log.push(Array.from(arguments).join())
      }
    }
  }

  let error = null
  if (!config.mode) {
    config.mode = 'grid'
  } else if (MODES.indexOf(config.mode) === -1) {
    error = `invalid mode "${config.mode}", options are: ${MODES.join(', ')}`
    config.mode = 'grid'
  }

  if (!config.api_root) {
    config.api_root = process.env.SOCKET_API_URL
  }

  if (!config.url_root) {
    config.url_root = 'auto'
  } else if (config.url_root !== 'auto' && config.url_root[0] !== '/') {
    config.url_root = '/'
    error = 'the "url_root" config parameter should start (and probably end) with a slash "/"'
  }

  if (config.url_root === 'auto') {
    config.url_root = auto_url_root(window.location.pathname)
    console.debug('auto generated url root:', config.url_root)
  }

  if (!config.router_mode) {
    // use history mode with enquiry so it doesn't add the hash
    config.router_mode = config.mode === 'enquiry' ? 'history' : 'hash'
  } else if (ROUTER_MODES.indexOf(config.router_mode) === -1) {
    error = `invalid router mode "${config.router_mode}", options are: ${ROUTER_MODES.join(', ')}`
    config.router_mode = 'hash'
  }

  if (!config.element) {
    config.element = '#socket'
  }

  if (config.subject_filter === undefined) {
    config.subject_filter = true
  }

  if (!config.event_callback) {
    config.event_callback = () => null
  }

  if (document.querySelector(config.element) === null) {
    config.console.error(`SOCKET: page element "${config.element}" does not exist, unable to start socket view.`)
    return
  }

  config.messages = config.messages || {}
  for (let k of Object.keys(STRINGS)) {
    if (!config.messages[k]) {
      config.messages[k] = STRINGS[k]
    }
  }
  const router = ConfiguredVueRouter(config)

  const ga_prefixes = init_ga(router, config)

  console.debug('using config:', config)

  const v = new Vue({
    el: config.element,
    router: router,
    render: h => h(app),
    data: {
      grecaptcha_key: process.env.GRECAPTCHA_KEY,
      contractors: [],
      subjects: [],
      contractors_extra: {},
      config: config,
      error: null,
      public_key: public_key,
      enquiry_form_info: {},
      enquiry_data: {},
      selected_subject_id: null,
      grecaptcha_container_id: 'grecaptcha_' + Math.random().toString(36).substring(2, 10),
    },
    components: {
      app
    },
    created () {
      if (error !== null) {
        this.handle_error(error)
      } else if (this.config.mode === 'grid') {
        this.get_contractor_list()
      }
    },
    watch: {
      '$route' (to, from) {
        console.debug(`navigated from ${from.path} to ${to.path}`, from, to)
        if (this.config.mode === 'grid' && to.name === 'index') {
          this.get_contractor_list()
        }
      }
    },
    methods: {
      // get_data is called by components, eg. grid
      handle_error (error_message) {
        this.error = error_message || 'unknown'
        config.console.error('SOCKET: ' + this.error)
        Raven.captureMessage(this.error, {
          level: 'error',
          fingerprint: ['{{ default }}', public_key],
        })
      },
      request (url, callback, expected_status, method, data) {
        const xhr = new window.XMLHttpRequest()
        method = method || 'GET'
        xhr.open(method, url)
        xhr.setRequestHeader('Accept', 'application/json')
        xhr.onload = () => {
          console.debug(`request ${method} ${url} > ${xhr.status}`, data, xhr)
          try {
            if (xhr.status !== (expected_status || 200)) {
              throw Error(`bad response status ${xhr.status} not 200`)
            } else {
              callback(xhr)
            }
          } catch (e) {
            this.handle_error(`\
${e.toString()}
requested url:   ${url}
response status: ${xhr.status}
response text:
${xhr.responseText}`)
          }
        }
        xhr.onerror = () => {
          this.handle_error(`\
Connection error
requested url:   ${url}
response status: ${xhr.status}
response text:   
${xhr.responseText}`)
        }
        xhr.send(data || null)
      },
      request_list (url, data_property, callback) {
        this.request(url, (xhr) => {
          const items = JSON.parse(xhr.responseText)
          data_property.splice(0)
          items.forEach(con => data_property.push(con))
          callback && callback(this)
        })
      },
      get_contractor_list () {
        if (this.$route.name === 'index') {
          if (this.$route.params.type === 's' && this.$route.params.link) {
            this.$set(this, 'selected_subject_id', parseInt(this.$route.params.link.match(/\d+/)[0]))
          } else {
            this.$set(this, 'selected_subject_id', null)
          }
        }
        const args = {subject: this.selected_subject_id}

        const arg_list = []
        for (let [name, value] of Object.entries(args)) {
          if (value !== null) {
            arg_list.push(encodeURIComponent(name) + '=' + encodeURIComponent(value))
          }
        }

        let url = `${config.api_root}/${public_key}/contractors`
        if (arg_list.length > 0) {
          url += '?' + arg_list.join('&')
        }
        const cb = (t) => this.config.event_callback('updated_contractors', t)
        this.request_list(url, this.contractors, cb)
      },
      get_contractor_details (url, link) {
        if (this.contractors_extra[link] !== undefined) {
          return false
        }
        this.request(url, (xhr) => {
          const con = JSON.parse(xhr.responseText)
          Vue.set(this.contractors_extra, link, con)
        })
        return true
      },
      get_enquiry () {
        if (Object.keys(this.enquiry_form_info).length !== 0 || this._getting_enquiry_info) {
          return
        }
        this.request(`${config.api_root}/${public_key}/enquiry`, (xhr) => {
          this.enquiry_form_info = Object.assign({}, this.enquiry_form_info, JSON.parse(xhr.responseText))
        })
      },
      submit_enquiry (callback) {
        const data = JSON.stringify(clean(this.enquiry_data))
        const request_callback = () => {
          this.enquiry_data = {}
          callback()
        }
        this.request(`${config.api_root}/${public_key}/enquiry`, request_callback, 201, 'POST', data)
      },
      get_subject_list () {
        if (this.subjects.length > 0) {
          return
        }
        this.request_list(`${config.api_root}/${public_key}/subjects`, this.subjects)
      },
      get_selected_subject () {
        if (this.selected_subject_id === null) {
          return null
        }
        for (let subject of this.subjects) {
          if (subject.id === this.selected_subject_id) {
            return subject
          }
        }
      },

      get_text (name, replacements, is_markdown) {
        let s = this.config.messages[name]
        for (let [k, v] of Object.entries(replacements || {})) {
          s = s.replace('{' + k + '}', v)
        }
        if (is_markdown === true) {
          return to_markdown(s)
        } else {
          return s
        }
      },
      ga_event (category, action, label) {
        /* istanbul ignore next */
        for (let prefix of ga_prefixes) {
          console.debug('ga sending event', prefix, category, action, label)
          window.ga(prefix + 'send', 'event', category, action, label)
        }
      },
      grecaptcha_callback (response) {
        Vue.set(this.enquiry_data, 'grecaptcha_response', response)
      },
      render_grecaptcha () {
        const el = document.getElementById(this.grecaptcha_container_id)
        if (el && el.childElementCount === 0) {
          console.debug('rendering grecaptcha')
          window.grecaptcha.render(this.grecaptcha_container_id, {
            sitekey: this.grecaptcha_key,
            callback: this.grecaptcha_callback
          })
        } else {
          console.debug('not rendering grecaptcha', el)
        }
      },

      goto (name, params) {
        this.$router.push({'name': name, params: params})
      }
    }
  })
  if (window.socket_view === undefined) {
    window.socket_view = [v]
  } else {
    window.socket_view.push(v)
  }

  window._tcs_grecaptcha_loaded = () => {
    for (let v of window.socket_view) {
      v.render_grecaptcha()
    }
  }
  return v
}
