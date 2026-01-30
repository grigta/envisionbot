import auth from "/Users/grigorijteresenko/envisionbot/pm-panel/layouts/auth.vue";
import _default from "/Users/grigorijteresenko/envisionbot/pm-panel/layouts/default.vue";
import type { ComputedRef, MaybeRef } from 'vue'
declare module 'nuxt/app' {
  interface NuxtLayouts {
    'auth': InstanceType<typeof auth>['$props'],
    'default': InstanceType<typeof _default>['$props'],
}
  export type LayoutKey = keyof NuxtLayouts extends never ? string : keyof NuxtLayouts
  interface PageMeta {
    layout?: MaybeRef<LayoutKey | false> | ComputedRef<LayoutKey | false>
  }
}