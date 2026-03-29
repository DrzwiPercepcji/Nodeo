import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { public: true },
    },
    {
      path: '/',
      name: 'collections',
      component: () => import('@/views/CollectionsView.vue'),
    },
    {
      path: '/collections/:id',
      name: 'collection-detail',
      component: () => import('@/views/CollectionDetailView.vue'),
    },
    {
      path: '/media/:id',
      name: 'player',
      component: () => import('@/views/PlayerView.vue'),
    },
  ],
})

router.beforeEach((to) => {
  const token = localStorage.getItem('nodeo_token')
  if (!to.meta.public && !token) {
    return { name: 'login' }
  }
  if (to.name === 'login' && token) {
    return { name: 'collections' }
  }
})

export default router
