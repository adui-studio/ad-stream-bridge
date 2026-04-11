---
layout: page
title: 团队
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
    desc: '个人开发者，负责 ad-stream-bridge 的产品设计、封装策略与工程实现。',
    links: [
      { icon: 'github', link: 'https://github.com/adui-dev' }
    ]
  },
  {
    avatar: 'https://github.com/adui-studio.png',
    name: 'ADui Studio',
    title: 'Studio',
    org: 'adui-studio',
    desc: '个人工作室与项目发布组织，负责仓库维护、文档站与开源生态展示。',
    links: [
      { icon: 'github', link: 'https://github.com/adui-studio' }
    ]
  }
]
</script>

<VPTeamPage>
  <VPTeamPageTitle>
    <template #title>团队</template>
    <template #lead>
      ad-stream-bridge 由 ADui 发起，并由 ADui Studio 作为项目组织与发布主体维护。
      该项目聚焦于产品级 CAD Viewer 的封装、文档体系与多框架接入体验。
    </template>
  </VPTeamPageTitle>

  <VPTeamMembers size="medium" :members="members" />
</VPTeamPage>
