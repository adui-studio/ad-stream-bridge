---
layout: page
title: Team
---

<script setup>
import {
  VPTeamPage,
  VPTeamPageTitle,
  VPTeamMembers
} from 'vitepress/theme'

const members = [
  {
    avatar: 'https://github.com/adui-dev.png',
    name: 'ADui',
    title: 'Creator',
    org: 'adui-dev',
    desc: 'Independent developer leading the product design, packaging strategy, and implementation of @adui/cad-viewer.',
    links: [
      { icon: 'github', link: 'https://github.com/adui-dev' }
    ]
  },
  {
    avatar: 'https://github.com/adui-studio.png',
    name: 'ADui Studio',
    title: 'Studio',
    org: 'adui-studio',
    desc: 'Studio and publishing organization responsible for repository maintenance, documentation site, and open-source presentation.',
    links: [
      { icon: 'github', link: 'https://github.com/adui-studio' }
    ]
  }
]
</script>

<VPTeamPage>
  <VPTeamPageTitle>
    <template #title>Team</template>
    <template #lead>
      ad-stream-bridge is initiated by ADui and maintained under ADui Studio as the project organization and publishing identity.
      The project focuses on product-level CAD Viewer packaging, documentation, and multi-framework integration experience.
    </template>
  </VPTeamPageTitle>

  <VPTeamMembers size="medium" :members="members" />
</VPTeamPage>
