export const profileShellResources = {
  ru: {
    common: {
      allProjects: 'Все проекты',
      goToProjects: 'К проектам',
      logout: 'Выйти',
      menu: 'Меню',
      myProfile: 'Мой кабинет',
      openHome: 'Перейти на главную страницу',
      user: 'Пользователь',
    },
    appErrors: {
      boundary: {
        description: 'Произошла непредвиденная ошибка интерфейса. Обновите страницу или вернитесь к проектам.',
        refresh: 'Обновить',
        title: 'Не удалось открыть страницу',
      },
      notFound: {
        description: 'Проверьте адрес или вернитесь к списку проектов.',
        title: 'Страница не найдена',
      },
    },
    auth: {
      login: {
        promo: {
          accent: 'нового поколения',
          description: 'Генерируйте сцены, персонажей и истории с помощью искусственного интеллекта.',
          featureCharacters: 'Уникальные персонажи',
          featureQuality: 'Кинематографичное качество',
          featureScenes: 'AI-генерация сцен',
          title: 'Создавайте фильмы',
        },
      },
      register: {
        promo: {
          accent: 'фильмы будущего',
          description: 'Создавайте сцены, персонажей и истории в единой AI-студии.',
          featureCharacters: 'Уникальные персонажи',
          featureControl: 'Полный творческий контроль',
          featureScenes: 'AI-генерация сцен',
          title: 'Начните создавать',
        },
      },
    },
    generationEdit: {
      action: 'Править',
      placeholder: 'Что хотите исправить в сгенерированном изображении?',
    },
    home: {
      hero: {
        description: 'Персонажи, сценарии, сцены, камера и генерация видео — в одном творческом пространстве.',
        title: 'Создавайте AI-фильмы с полным контролем',
      },
      cards: {
        challenges: {
          badge: 'Скоро',
          description: 'Создавайте ролики и побеждайте врагов.',
          title: 'Челленджи',
        },
        channel: {
          description: 'Управляйте публикациями, профилем и витриной работ.',
          title: 'Мой канал',
        },
        cinema: {
          badge: 'В разработке',
          description: 'Открывайте фильмы, сцены и ролики других авторов.',
          title: 'Кинотеатр',
        },
        createProject: {
          description: 'Начните новый фильм, сцену или генеративный ролик.',
          title: 'Создать проект',
        },
        projects: {
          description: 'Откройте существующие проекты и продолжите работу.',
          title: 'Мои проекты',
        },
        subscriptions: {
          badge: 'В разработке',
          description: 'Следите за новыми работами любимых авторов.',
          title: 'Подписки',
        },
      },
    },
    notifications: {
      invalidInput: 'Ошибка в заполнении',
    },
    profile: {
      about: {
        empty: 'Расскажите о себе, своих проектах и творческих интересах.',
        fillProfile: 'Заполнить профиль',
        interests: 'Интересы',
        title: '👤 О себе',
      },
      analytics: {
        averageTime: 'Среднее время',
        last30Days: 'Последние 30 дней',
        title: '📈 Статистика просмотров',
        uniqueViewers: 'Уникальные зрители',
        views: 'Просмотры',
        viewsCount: '{{count}} просмотров',
      },
      awards: {
        empty: 'Награды появятся после первых действий на Craft',
        showAll: 'Смотреть все',
        title: '🏆 Награды',
      },
      completion: {
        description: 'Заполните все поля',
        fields: {
          about: 'О себе',
          avatar: 'Аватар',
          interests: 'Интересы',
          socials: 'Соцсети',
        },
        title: 'Профиль заполнен',
      },
      continueWatching: {
        continueFrom: 'с {{time}}',
        empty: 'Вы ещё не смотрели видео',
        title: '▶️ Продолжить просмотр',
      },
      dashboard: {
        loadError: 'Не удалось загрузить личный кабинет',
      },
      edit: {
        actions: {
          back: 'В кабинет',
          cancel: 'Отмена',
          save: 'Сохранить изменения',
          saving: 'Сохранение…',
        },
        basic: {
          bio: 'О себе',
          bioHint: 'Расскажите о себе. Максимум {{count}} символов.',
          displayName: 'Отображаемое имя',
          displayNameHint: 'Как ваше имя будет отображаться для других пользователей.',
          title: 'Основная информация',
          username: 'Имя пользователя',
          usernameHint: 'Уникальное имя для вашего профиля. Используется в ссылке.',
        },
        errors: {
          generic: 'Произошла ошибка. Попробуйте снова.',
          interestsLimit: 'Можно добавить максимум 10 интересов',
          invalidSocials: 'Одна или несколько ссылок некорректны. Проверьте формат URL (например: https://t.me/username).',
          invalidUsername: 'Имя пользователя может содержать только строчные латинские буквы, цифры, «-» и «_» (3–32 символа).',
          load: 'Не удалось загрузить профиль. Попробуйте обновить страницу.',
          save: 'Не удалось сохранить. Проверьте данные и попробуйте снова.',
          validation: 'Не удалось сохранить. Проверьте введённые данные.',
          usernameTaken: 'Это имя пользователя уже занято',
        },
        interests: {
          addPlaceholder: 'Добавить интерес и нажмите Enter',
          description: 'Выберите темы, которые вам интересны.',
          empty: 'Пока нет интересов — добавьте первый.',
          limit: 'Можно добавить максимум {{count}} интересов',
          limitPlaceholder: 'Достигнут лимит интересов',
          remove: 'Удалить {{interest}}',
          title: 'Интересы',
        },
        loading: 'Загрузка профиля…',
        media: {
          bioFallback: 'Расскажите о себе',
          changeCover: 'Изменить обложку',
          delete: 'Удалить',
          deleteCover: 'Удалить обложку',
          description: 'Настройте аватар и обложку профиля.',
          title: 'Ваш профиль',
          uploadAvatar: 'Загрузить аватар',
        },
        preview: {
          checklist: {
            about: 'О себе (мин. 10 символов)',
            basic: 'Основная информация',
            interests: 'Интересы (мин. 3)',
            media: 'Аватар и обложка',
            settings: 'Настройки профиля',
            socials: 'Соцсети и ссылки (мин. 1)',
          },
          completion: 'Профиль заполнен на {{percent}}%',
          completionHint: 'Заполните все разделы, чтобы ваш профиль выглядел ещё лучше.',
          description: 'Так ваш профиль увидят другие пользователи.',
          title: 'Предпросмотр профиля',
        },
        socials: {
          title: 'Соцсети и ссылки',
          website: 'Сайт',
        },
        success: 'Изменения сохранены',
        title: 'Редактирование профиля',
        unsaved: 'Есть несохранённые изменения',
      },
      favoriteGenres: {
        title: '🎬 Любимые жанры',
      },
      hero: {
        avatarAlt: 'Аватар пользователя',
        edit: 'Редактировать профиль',
      },
      sidebar: {
        awards: 'Награды',
        history: 'История просмотров',
        messages: 'Сообщения',
        profile: 'Мой кабинет',
        recommendations: 'Рекомендации',
        saved: 'Сохранённое',
        settings: 'Настройки',
        statistics: 'Статистика',
        subscriptions: 'Подписки',
      },
      stats: {
        history: 'История просмотров',
        messages: 'Сообщения',
        recommendations: 'Рекомендации',
        subscriptions: 'Подписки',
        views: 'Просмотры',
      },
    },
    subscriptions: {
      channel: {
        subscribe: 'Подписаться',
        subscribed: 'Подписан',
        subscribers: 'подписчиков',
        unsubscribe: 'Отписаться',
        unknown: 'Неизвестный канал',
      },
    },
    unsavedChanges: {
      confirm: 'У вас есть несохранённые изменения. Покинуть страницу?',
    },
  },
  en: {
    common: {
      allProjects: 'All projects',
      goToProjects: 'Go to projects',
      logout: 'Log out',
      menu: 'Menu',
      myProfile: 'My profile',
      openHome: 'Go to the home page',
      user: 'User',
    },
    appErrors: {
      boundary: {
        description: 'An unexpected interface error occurred. Refresh the page or return to your projects.',
        refresh: 'Refresh',
        title: 'Could not open the page',
      },
      notFound: {
        description: 'Check the address or return to the project list.',
        title: 'Page not found',
      },
    },
    auth: {
      login: {
        promo: {
          accent: 'for a new generation',
          description: 'Generate scenes, characters, and stories with artificial intelligence.',
          featureCharacters: 'Unique characters',
          featureQuality: 'Cinematic quality',
          featureScenes: 'AI scene generation',
          title: 'Create films',
        },
      },
      register: {
        promo: {
          accent: 'films of the future',
          description: 'Create scenes, characters, and stories in one AI studio.',
          featureCharacters: 'Unique characters',
          featureControl: 'Full creative control',
          featureScenes: 'AI scene generation',
          title: 'Start creating',
        },
      },
    },
    generationEdit: {
      action: 'Edit',
      placeholder: 'What would you like to change in the generated image?',
    },
    home: {
      hero: {
        description: 'Characters, scripts, scenes, camera, and video generation — all in one creative space.',
        title: 'Create AI films with full control',
      },
      cards: {
        challenges: {
          badge: 'Coming soon',
          description: 'Create videos and defeat your rivals.',
          title: 'Challenges',
        },
        channel: {
          description: 'Manage publications, your profile, and your work showcase.',
          title: 'My channel',
        },
        cinema: {
          badge: 'In development',
          description: 'Discover films, scenes, and videos by other creators.',
          title: 'Cinema',
        },
        createProject: {
          description: 'Start a new film, scene, or generative video.',
          title: 'Create project',
        },
        projects: {
          description: 'Open an existing project and continue working.',
          title: 'My projects',
        },
        subscriptions: {
          badge: 'In development',
          description: 'Follow new work from your favorite creators.',
          title: 'Subscriptions',
        },
      },
    },
    notifications: {
      invalidInput: 'Invalid input',
    },
    profile: {
      about: {
        empty: 'Share a little about yourself, your projects, and your creative interests.',
        fillProfile: 'Complete profile',
        interests: 'Interests',
        title: '👤 About',
      },
      analytics: {
        averageTime: 'Average time',
        last30Days: 'Last 30 days',
        title: '📈 View statistics',
        uniqueViewers: 'Unique viewers',
        views: 'Views',
        viewsCount: '{{count}} views',
      },
      awards: {
        empty: 'Awards will appear after your first actions on Craft',
        showAll: 'View all',
        title: '🏆 Awards',
      },
      completion: {
        description: 'Complete every field',
        fields: {
          about: 'About',
          avatar: 'Avatar',
          interests: 'Interests',
          socials: 'Social links',
        },
        title: 'Profile completion',
      },
      continueWatching: {
        continueFrom: 'from {{time}}',
        empty: "You haven't watched any videos yet",
        title: '▶️ Continue watching',
      },
      dashboard: {
        loadError: 'Could not load your profile',
      },
      edit: {
        actions: {
          back: 'Back to profile',
          cancel: 'Cancel',
          save: 'Save changes',
          saving: 'Saving…',
        },
        basic: {
          bio: 'About',
          bioHint: 'Tell people about yourself. Maximum {{count}} characters.',
          displayName: 'Display name',
          displayNameHint: 'This is how your name appears to other people.',
          title: 'Basic information',
          username: 'Username',
          usernameHint: 'A unique name for your profile. It is used in the profile link.',
        },
        errors: {
          generic: 'An error occurred. Please try again.',
          interestsLimit: 'You can add up to 10 interests',
          invalidSocials: 'One or more links are invalid. Check the URL format (for example, https://t.me/username).',
          invalidUsername: 'The username may contain only lowercase Latin letters, digits, “-”, and “_” (3–32 characters).',
          load: 'Could not load the profile. Try refreshing the page.',
          save: 'Could not save. Check the information and try again.',
          validation: 'Could not save. Check the information you entered.',
          usernameTaken: 'This username is already taken',
        },
        interests: {
          addPlaceholder: 'Add an interest and press Enter',
          description: 'Choose topics that interest you.',
          empty: 'No interests yet — add the first one.',
          limit: 'You can add up to {{count}} interests',
          limitPlaceholder: 'Interest limit reached',
          remove: 'Remove {{interest}}',
          title: 'Interests',
        },
        loading: 'Loading profile…',
        media: {
          bioFallback: 'Tell people about yourself',
          changeCover: 'Change cover',
          delete: 'Delete',
          deleteCover: 'Delete cover',
          description: 'Customize your profile avatar and cover.',
          title: 'Your profile',
          uploadAvatar: 'Upload avatar',
        },
        preview: {
          checklist: {
            about: 'About (min. 10 characters)',
            basic: 'Basic information',
            interests: 'Interests (min. 3)',
            media: 'Avatar and cover',
            settings: 'Profile settings',
            socials: 'Social links (min. 1)',
          },
          completion: 'Profile {{percent}}% complete',
          completionHint: 'Complete every section to make your profile more informative.',
          description: 'This is how other people will see your profile.',
          title: 'Profile preview',
        },
        socials: {
          title: 'Social links',
          website: 'Website',
        },
        success: 'Changes saved',
        title: 'Edit profile',
        unsaved: 'You have unsaved changes',
      },
      favoriteGenres: {
        title: '🎬 Favorite genres',
      },
      hero: {
        avatarAlt: 'User avatar',
        edit: 'Edit profile',
      },
      sidebar: {
        awards: 'Awards',
        history: 'Watch history',
        messages: 'Messages',
        profile: 'My profile',
        recommendations: 'Recommendations',
        saved: 'Saved',
        settings: 'Settings',
        statistics: 'Statistics',
        subscriptions: 'Subscriptions',
      },
      stats: {
        history: 'Watch history',
        messages: 'Messages',
        recommendations: 'Recommendations',
        subscriptions: 'Subscriptions',
        views: 'Views',
      },
    },
    subscriptions: {
      channel: {
        subscribe: 'Subscribe',
        subscribed: 'Subscribed',
        subscribers: 'subscribers',
        unsubscribe: 'Unsubscribe',
        unknown: 'Unknown channel',
      },
    },
    unsavedChanges: {
      confirm: 'You have unsaved changes. Leave this page?',
    },
  },
} as const;
