import { defineConfig } from 'vitepress';

const githubRepo = 'https://github.com/adui-studio/ad-stream-bridge';
const editPattern = 'https://github.com/adui-studio/ad-stream-bridge/edit/main/docs/:path';

export default defineConfig({
  title: 'ad-stream-bridge',
  description: 'A production-oriented monorepo for backend stream bridging services.',
  cleanUrls: true,
  lastUpdated: true,
  appearance: true,
  base: '/ad-stream-bridge/',
  head: [['link', { rel: 'icon', href: '/ad-stream-bridge/ad-stream-bridge-logo.svg' }]],

  themeConfig: {
    search: {
      provider: 'local',
      options: {
        locales: {
          root: {
            translations: {
              button: {
                buttonText: '搜索',
                buttonAriaLabel: '搜索'
              },
              modal: {
                displayDetails: '显示详细列表',
                resetButtonTitle: '重置搜索',
                backButtonTitle: '关闭搜索',
                noResultsText: '没有结果',
                footer: {
                  selectText: '选择',
                  selectKeyAriaLabel: '回车',
                  navigateText: '切换',
                  navigateUpKeyAriaLabel: '向上箭头',
                  navigateDownKeyAriaLabel: '向下箭头',
                  closeText: '关闭',
                  closeKeyAriaLabel: 'Esc'
                }
              }
            }
          },
          en: {
            translations: {
              button: {
                buttonText: 'Search',
                buttonAriaLabel: 'Search'
              },
              modal: {
                displayDetails: 'Display detailed list',
                resetButtonTitle: 'Reset search',
                backButtonTitle: 'Close search',
                noResultsText: 'No results found',
                footer: {
                  selectText: 'Select',
                  selectKeyAriaLabel: 'Enter',
                  navigateText: 'Navigate',
                  navigateUpKeyAriaLabel: 'Arrow up',
                  navigateDownKeyAriaLabel: 'Arrow down',
                  closeText: 'Close',
                  closeKeyAriaLabel: 'Esc'
                }
              }
            }
          }
        }
      }
    },
    socialLinks: [
      {
        icon: 'github',
        link: githubRepo,
        ariaLabel: 'GitHub'
      }
    ]
  },

  locales: {
    root: {
      label: '简体中文',
      lang: 'zh-CN',
      title: 'ad-stream-bridge',
      description: '面向生产可用性的后端流桥接服务 monorepo。',
      themeConfig: {
        i18nRouting: true,
        logo: {
          light: '/ad-stream-bridge-logo.svg',
          dark: '/ad-stream-bridge-logo.svg',
          alt: 'ad-stream-bridge'
        },
        siteTitle: 'ad-stream-bridge',
        nav: [
          { text: '指南', link: '/guide/getting-started' },
          { text: '参考', link: '/reference/api' },
          { text: '项目', link: '/project/architecture' },
          { text: '团队', link: '/team' }
        ],
        sidebar: {
          '/guide/': [
            {
              text: '指南',
              items: [
                { text: '快速开始', link: '/guide/getting-started' },
                { text: '配置说明', link: '/guide/configuration' },
                { text: '恢复策略', link: '/guide/runtime-recovery' }
              ]
            }
          ],
          '/reference/': [
            {
              text: '参考',
              items: [
                { text: 'API', link: '/reference/api' },
                { text: 'Healthz', link: '/reference/healthz' },
                { text: '运行验证', link: '/reference/runtime-verification' }
              ]
            }
          ],
          '/project/': [
            {
              text: '项目',
              items: [
                { text: '架构说明', link: '/project/architecture' },
                { text: '部署说明', link: '/project/deployment' },
                { text: '研发流程', link: '/project/development-workflow' },
                { text: '路线图', link: '/project/roadmap' }
              ]
            }
          ],
          '/team': [
            {
              text: '团队',
              items: [{ text: '团队成员', link: '/team' }]
            }
          ]
        },
        aside: true,
        outline: {
          level: [2, 3],
          label: '本页目录'
        },
        footer: {
          message: 'Built with VitePress',
          copyright: 'Copyright © ADui Studio'
        },
        editLink: {
          pattern: editPattern,
          text: '在 GitHub 上编辑此页'
        },
        lastUpdated: {
          text: '最后更新于',
          formatOptions: {
            dateStyle: 'medium',
            timeStyle: 'short'
          }
        },
        docFooter: {
          prev: '上一页',
          next: '下一页'
        },
        darkModeSwitchLabel: '外观',
        lightModeSwitchTitle: '切换到浅色模式',
        darkModeSwitchTitle: '切换到深色模式',
        sidebarMenuLabel: '菜单',
        returnToTopLabel: '返回顶部',
        langMenuLabel: '切换语言',
        externalLinkIcon: true
      }
    },

    en: {
      label: 'English',
      lang: 'en-US',
      title: 'ad-stream-bridge',
      description: 'A production-oriented monorepo for backend stream bridging services.',
      link: '/en/',
      themeConfig: {
        i18nRouting: true,
        logo: {
          light: '/ad-stream-bridge-logo.svg',
          dark: '/ad-stream-bridge-logo.svg',
          alt: 'ad-stream-bridge'
        },
        siteTitle: 'ad-stream-bridge',
        nav: [
          { text: 'Guide', link: '/en/guide/getting-started' },
          { text: 'Reference', link: '/en/reference/api' },
          { text: 'Project', link: '/en/project/architecture' },
          { text: 'Team', link: '/en/team' }
        ],
        sidebar: {
          '/en/guide/': [
            {
              text: 'Guide',
              items: [
                { text: 'Getting Started', link: '/en/guide/getting-started' },
                { text: 'Configuration', link: '/en/guide/configuration' },
                { text: 'Runtime Recovery', link: '/en/guide/runtime-recovery' }
              ]
            }
          ],
          '/en/reference/': [
            {
              text: 'Reference',
              items: [
                { text: 'API', link: '/en/reference/api' },
                { text: 'Healthz', link: '/en/reference/healthz' },
                { text: 'Runtime Verification', link: '/en/reference/runtime-verification' }
              ]
            }
          ],
          '/en/project/': [
            {
              text: 'Project',
              items: [
                { text: 'Architecture', link: '/en/project/architecture' },
                { text: 'Deployment', link: '/en/project/deployment' },
                { text: 'Development Workflow', link: '/en/project/development-workflow' },
                { text: 'Roadmap', link: '/en/project/roadmap' }
              ]
            }
          ],
          '/en/team': [
            {
              text: 'Team',
              items: [{ text: 'Members', link: '/en/team' }]
            }
          ]
        },
        aside: true,
        outline: {
          level: [2, 3],
          label: 'On this page'
        },
        footer: {
          message: 'Built with VitePress',
          copyright: 'Copyright © ADui Studio'
        },
        editLink: {
          pattern: editPattern,
          text: 'Edit this page on GitHub'
        },
        lastUpdated: {
          text: 'Last updated',
          formatOptions: {
            dateStyle: 'medium',
            timeStyle: 'short'
          }
        },
        docFooter: {
          prev: 'Previous page',
          next: 'Next page'
        },
        darkModeSwitchLabel: 'Appearance',
        lightModeSwitchTitle: 'Switch to light mode',
        darkModeSwitchTitle: 'Switch to dark mode',
        sidebarMenuLabel: 'Menu',
        returnToTopLabel: 'Return to top',
        langMenuLabel: 'Change language',
        externalLinkIcon: true
      }
    }
  }
});
