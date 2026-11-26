import type { SiteContent } from "./types";
import { legalFr } from "./legal-fr";

export const fr: SiteContent = {
  common: {
    breadcrumb: "Fil d’Ariane",
    readMore: "Lire l'article",
    backToResources: "Retour aux ressources",
    related: "À lire aussi",
    legalStatus: "Statut",
    legalNav: "Politiques",
    talkToUs: "Parlez-nous",
    startTrial: "Essai gratuit",
    illustrative: "Photographie et interface d'illustration. Aucun témoignage client.",
    illustrativePhoto: "Photographie d'illustration.",
    illustrativePhotoAlt: "Photo d’illustration de personnes travaillant dans une petite entreprise",
    home: "Accueil",
    resources: "Ressources",
    takeaway: "À retenir",
    source: "Source",
    editorial: "La rédaction KontaFlow",
  },
  home: {
    metaTitle: "KontaFlow — Vos finances d'entreprise. Simplifiées. Partout.",
    metaDescription:
      "KontaFlow réunit la comptabilité, la visibilité sur la trésorerie et un assistant IA sur le web, WhatsApp, l'USSD et hors ligne. Conçu pour les petites entreprises africaines.",
    hero: {
      eyebrow: "La comptabilité pensée pour l'entreprise africaine",
      title: "Vos finances d'entreprise.",
      accent: "Simplifiées. Partout.",
      subtitle:
        "Enregistrez ventes et dépenses sur le web, par WhatsApp, par USSD ou hors ligne. KontaFlow tient un seul livre propre et le transforme en réponses utiles.",
      primary: "Commencer l'essai gratuit",
      secondary: "Découvrir les fonctions",
      note: "Essai de 7 jours · sans carte · anglais, français et pidgin",
      imageAlt: "Une entrepreneuse consultant son travail sur un ordinateur portable et une tablette dans un bureau lumineux",
      overlayTitle: "Un seul livre. Tous les canaux.",
      overlayBody: "Une vente sur WhatsApp et un paiement par USSD arrivent dans les mêmes comptes.",
      channels: ["Application web", "WhatsApp", "USSD", "Hors ligne", "Assistant IA"],
      trust: [
        { value: "XAF", label: "Devise par défaut" },
        { value: "3", label: "Langues d'interface" },
        { value: "RLS", label: "Isolation par espace" },
        { value: "Hors ligne", label: "File et synchro" },
      ],
    },
    position: {
      eyebrow: "Pensé pour la vraie journée",
      title: "Vos comptes doivent s'adapter à votre entreprise, pas l'inverse.",
      body:
        "La plupart des outils supposent un bureau, une connexion stable et une équipe financière. KontaFlow suppose une boutique animée, un téléphone à la main et de l'argent qui circule de plusieurs façons.",
      note: "L'isolation des espaces, les permissions et les traces d'audit sont appliquées dans la base de données — pas seulement dans l'interface.",
      stack: ["Next.js", "Supabase", "PostgreSQL", "Sécurité par ligne", "PWA"],
      points: [
        {
          title: "Espèces et mobile money ensemble",
          body:
            "Enregistrez les espèces, le mobile money, la banque et la carte au même endroit. Chaque écriture garde son canal, sa date et sa devise.",
        },
        {
          title: "Des chiffres que votre comptable peut suivre",
          body:
            "Chaque transaction validée crée des lignes équilibrées. Les corrections sont traçables au lieu de réécrire l'histoire en silence.",
        },
        {
          title: "Léger en données, utile hors ligne",
          body:
            "L'application web s'installe comme une application et garde les écritures en attente sur l'appareil jusqu'au retour du réseau.",
        },
      ],
    },
    problem: {
      eyebrow: "Le problème",
      title: "Quand les comptes vivent dans la tête, l'entreprise reste dans le flou.",
      subtitle:
        "Cahiers, mémoire du téléphone et plusieurs fils de discussion rendent difficile de savoir ce qui est vrai — et quoi faire ensuite.",
      cards: [
        {
          title: "Trois versions de la vérité",
          body:
            "Le cahier dit une chose, le mobile money une autre, et le solde bancaire quelque chose d'autre. Les rapprocher prend une soirée que vous n'avez pas.",
        },
        {
          title: "Les ventes sont retenues, pas enregistrées",
          body:
            "Les petites ventes quotidiennes semblent trop banales pour être notées. À la fin du mois, la plus grande partie de l'activité a disparu des comptes.",
        },
        {
          title: "Les rapports arrivent après la décision",
          body:
            "Attendre le résumé de fin de mois signifie découvrir un mauvais mois quand il est déjà terminé.",
        },
      ],
      imageAlt: "Rue de marché à Douala avec commerçants et circulation",
      imageCaption: "Marché Mboppi, Douala. Photographie d'illustration, pas un client.",
    },
    solution: {
      eyebrow: "La méthode KontaFlow",
      title: "Saisir une fois. Comprendre tout de suite. Clôturer correctement.",
      subtitle:
        "KontaFlow associe un vrai livre comptable à des canaux adaptés à la façon dont l'argent arrive réellement.",
      cards: [
        {
          title: "Enregistrer en quelques secondes",
          body:
            "Utilisez le formulaire, un message WhatsApp, un menu USSD ou une saisie hors ligne. Chaque canal écrit dans le même espace.",
        },
        {
          title: "Garder le détail",
          body:
            "Dates, contacts, catégories, reçus et provenance du canal restent attachés pour que l'écriture ait encore du sens l'an prochain.",
        },
        {
          title: "Voir ce qui a changé",
          body:
            "Recettes, dépenses, bénéfice et trésorerie bougent ensemble sur un tableau de bord conçu pour un contrôle quotidien rapide.",
        },
        {
          title: "Poser une question ancrée",
          body:
            "L'assistant ne lit que les dossiers auxquels vous avez droit, explique sa réponse et peut préparer une écriture à confirmer.",
        },
      ],
      ledgerNote: "→ un seul livre",
    },
    ai: {
      eyebrow: "Comptabilité IA",
      title: "Dites ce qui s'est passé. Vérifiez ce qui a été enregistré.",
      subtitle:
        "La saisie en langage naturel n'est pas un tour de magie. KontaFlow transforme une phrase claire en transaction structurée, montre la catégorie et le montant, puis vous laisse confirmer.",
      prompt: "J'ai dépensé 5 000 FCFA de carburant ce matin.",
      reply:
        "Dépense carburant · 5 000 FCFA · Mobile Money · aujourd'hui. Le transport représente 18 % de vos dépenses ce mois. Confirmer ?",
      bullets: [
        "Fonctionne en français, anglais et pidgin camerounais.",
        "Demande avant de valider un montant, une catégorie ou une date flous.",
        "Répond à partir de votre espace autorisé, jamais de celui d'un autre client.",
      ],
      imageAlt: "Vendeur de marché consultant son téléphone dans un étal coloré",
      note: "Illustration produit. L'IA peut se tromper ; vérifiez les écritures avant validation.",
      confirm: "Confirmer",
      edit: "Modifier",
    },
    dashboard: {
      eyebrow: "Aperçu du tableau de bord",
      title: "La réponse du matin à « comment va le business ? »",
      subtitle:
        "Un écran d'accueil clair montre ce qui est entré, ce qui est sorti et ce qui reste — sans tableur.",
      bullets: [
        "Recettes, dépenses et bénéfice net sur la période choisie.",
        "Trésorerie disponible avec les derniers mouvements.",
        "Activité récente étiquetée web, WhatsApp, USSD ou synchronisation hors ligne.",
      ],
      note: "Aperçu produit avec des données d'exemple.",
      weekdays: ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"],
      sampleRows: [{"label":"Vente · 18 000","channel":"WhatsApp"},{"label":"Carburant · 5 000","channel":"Web"},{"label":"Crédit · 1 000","channel":"Hors ligne"}],
    },
    incomeExpense: {
      eyebrow: "Recettes et dépenses",
      title: "Chaque franc a une catégorie.",
      subtitle:
        "Saisie simple quand vous êtes pressé. Structure comptable correcte quand vient le moment de clôturer.",
      cards: [
        {
          title: "Des recettes qui gardent leur source",
          body:
            "Enregistrez une vente, un paiement de facture ou un autre revenu avec un client et un compte de produit.",
        },
        {
          title: "Des dépenses qui s'expliquent",
          body:
            "Saisissez carburant, stock, loyer, crédit téléphonique, salaires et plus, avec reçus ou notes joints.",
        },
        {
          title: "Des corrections sans dissimulation",
          body:
            "Annulez une écriture validée par une contre-passation. L'original reste visible et la piste d'audit intacte.",
        },
      ],
      imageAlt: "Agent de mobile money servant un client dans une petite boutique",
      caption: "Espèces, mobile money, banque et carte — un seul livre.",
    },
    analysis: {
      eyebrow: "Analyse financière",
      title: "Transformez une liste de transactions en point de vue.",
      subtitle:
        "KontaFlow regroupe le détail pour voir la marge, la pression des dépenses et les clients ou catégories qui portent l'activité.",
      note: "Le compte de résultat, la trésorerie et les rapports par catégorie viennent du même livre.",
      cards: [
        {
          title: "Le bénéfice, pas seulement le chiffre d'affaires",
          body:
            "Comparez les recettes aux coûts qui les ont produites. Une semaine chargée peut rester une semaine maigre.",
        },
        {
          title: "Où l'argent fuit",
          body: "Voyez les principales catégories de dépenses et leur évolution mois après mois.",
        },
        {
          title: "Qui vous paie",
          body:
            "Comprenez quels clients et produits portent l'entreprise — et ceux qui vous coûtent discrètement.",
        },
      ],
      chart: {
        kicker: "Répartition des dépenses",
        title: "Où va l'argent",
        sample: "Exemple",
        period: "Ce mois-ci",
        categories: [
          { label: "Achats de stock", pct: 42 },
          { label: "Transport", pct: 24 },
          { label: "Loyer et charges", pct: 18 },
          { label: "Crédit et données", pct: 9 },
          { label: "Autres", pct: 7 },
        ],
        note: "Le transport est la catégorie qui grandit le plus vite. Vérifiez carburant et livraison avant qu'ils ne rongent la marge.",
      },
    },
    offline: {
      eyebrow: "Saisie hors ligne",
      title: "Gardez la file qui avance quand le réseau s'arrête.",
      subtitle:
        "Jours de marché, déplacements et coupures ne mettent pas l'entreprise en pause. KontaFlow enregistre maintenant et rapproche plus tard.",
      bullets: [
        "Les écritures attendent sur l'appareil avec leur date métier d'origine.",
        "L'application réessaie sans risque et évite les doublons.",
        "L'état de synchronisation est visible, sans deviner ce qui a été envoyé.",
      ],
      queued: "2 écritures en attente sur cet appareil",
      synced: "Toutes les modifications sont enregistrées",
      imageAlt: "Personne tenant un téléphone mobile",
    },
    whatsapp: {
      eyebrow: "WhatsApp",
      title: "Votre application la plus utilisée devient un canal comptable.",
      subtitle:
        "Envoyez un message simple sur une vente ou une dépense. KontaFlow le lit, propose une écriture structurée et répond avec ce qu'il a compris.",
      chat: [
        { from: "them", text: "Vendu 12 cartons d'eau à 18 000 FCFA." },
        { from: "us", text: "Enregistré en recette — Ventes. Client enregistré comme « Passage ». Autre chose ?" },
        { from: "them", text: "Acheté du carburant pour 5 000." },
        { from: "us", text: "Enregistré en dépense Transport. Le carburant représente 12 % de vos coûts ce mois." },
      ],
      bullets: [
        "Aucune nouvelle application à installer pour la personne qui écrit.",
        "Montant, catégorie et date métier sont confirmés avant validation.",
        "Lié à l'espace avec les droits de l'expéditeur, pas un mot de passe partagé.",
      ],
      note: "Conversation d'exemple avec données fictives. Les réponses réelles dépendent de vos dossiers et réglages de confirmation.",
      imageAlt: "Commerçant devant une petite boutique",
      businessLabel: "Compte professionnel",
      messagePlaceholder: "Message",
    },
    ussd: {
      eyebrow: "USSD",
      title: "La comptabilité sur le téléphone que vous avez déjà.",
      subtitle:
        "Pas de smartphone, pas de forfait data, pas de problème. Un menu court permet d'enregistrer l'argent et de vérifier la journée.",
      screenTitle: "*384*12#",
      screenLines: ["1. Enregistrer une vente", "2. Enregistrer une dépense", "3. Voir le solde", "4. Total du jour"],
      screenFooter: "Répondez avec un numéro",
      bullets: [
        "Fonctionne sur téléphones simples et à touches.",
        "Utilise le même espace et le même livre que l'application web.",
        "Les limites de session et d'usage protègent le compte.",
      ],
      note: "Le libellé du menu et le code court peuvent varier selon le déploiement et le réseau.",
      imageAlt: "Téléphone à touches tenu dans une main",
    },
    reports: {
      eyebrow: "Rapports automatisés",
      title: "La fin du mois sans archéologie.",
      subtitle:
        "Générez les rapports que vous utilisez vraiment, à partir du même livre alimenté chaque jour.",
      items: [
        "Compte de résultat",
        "Trésorerie",
        "Catégories de dépenses",
        "Ventes par client ou produit",
        "Exports CSV pour comptable",
        "Références des reçus et documents",
      ],
      body:
        "Les rapports respectent le fuseau horaire et la devise de l'espace et peuvent être exportés pour une banque, un fiscaliste ou un comptable.",
      imageAlt: "Gros plan sur un ordinateur portable affichant des graphiques financiers à côté d’un rapport imprimé",
      packTitle: "Dossier de clôture",
      packLine: "Résultat · Trésorerie · CSV",
    },
    intelligence: {
      eyebrow: "Intelligence d'affaires",
      title: "La prochaine question, déjà en vue.",
      subtitle:
        "KontaFlow repère les changements qui méritent votre attention et les explique simplement.",
      insights: [
        { label: "Coûts de transport", value: "+18 %", note: "Par rapport au mois dernier" },
        { label: "Meilleure marge", value: "Boissons", note: "Sur les 30 derniers jours" },
        { label: "Client lent", value: "2 factures", note: "En retard de paiement" },
      ],
      bullets: [
        "Posez des questions de suivi en langage courant.",
        "Voyez quels chiffres soutiennent la réponse.",
        "Transformez un constat en écriture, rappel ou rapport.",
      ],
      note: "Les constats aident à décider ; ils ne sont pas un avis audité. Vérifiez les dossiers sous-jacents.",
    },
    subscription: {
      eyebrow: "Abonnements",
      title: "Commencez gratuitement. Payez quand l'entreprise grandit.",
      subtitle:
        "Chaque offre inclut le livre de base et tous les canaux de saisie. Les offres payantes ajoutent de la capacité pour les équipes et les gros volumes.",
      tiers: [
        {
          name: "Starter",
          price: "0",
          period: "FCFA",
          description: "Pour un commerçant seul qui met ses comptes en ordre.",
          features: [
            "Un espace",
            "Transactions illimitées",
            "Web, WhatsApp, USSD et hors ligne",
            "Crédit d'assistant IA",
          ],
          cta: "Commencer gratuitement",
        },
        {
          name: "Growth",
          price: "9 900",
          period: "FCFA / mois",
          description: "Pour une boutique ou une petite équipe au volume quotidien.",
          features: [
            "Plus de sièges et de messages IA",
            "Tout Starter",
            "Exports comptables",
            "Support prioritaire",
          ],
          cta: "Parlez-nous",
          featured: true,
        },
        {
          name: "Scale",
          price: "29 900",
          period: "FCFA / mois",
          description: "Pour les équipes plus grandes et plusieurs points de vente.",
          features: [
            "Le plus grand quota de sièges et d'IA",
            "Tout Growth",
            "Accompagnement des configurations complexes",
            "Support prioritaire",
          ],
          cta: "Parlez-nous",
        },
      ],
      footnote:
        "Prix en FCFA, facturés mensuellement lorsque la facturation payante est mise en place. L'offre Starter reste gratuite. Des taxes peuvent s'appliquer.",
      includedTitle: "Chaque offre comprend",
      included: [
        "Le livre en partie double",
        "Saisie web, WhatsApp, USSD et hors ligne",
        "Rapports et exports CSV",
        "Vérification e-mail et téléphone",
      ],
    },
    faq: {
      eyebrow: "Questions",
      title: "Des réponses claires avant de commencer.",
      subtitle: "Ce que les propriétaires et leurs comptables nous demandent le plus.",
      items: [
        {
          question: "Faut-il un smartphone pour utiliser KontaFlow ?",
          answer:
            "Non. L'application web est l'expérience la plus complète, mais l'USSD permet de saisir et de consulter les soldes depuis un téléphone simple. WhatsApp nécessite un smartphone ou l'application de bureau.",
        },
        {
          question: "L'offre Starter est-elle vraiment gratuite ?",
          answer:
            "Oui. Starter coûte 0 FCFA et inclut un espace, des transactions illimitées et tous les canaux de saisie. Les offres payantes ajoutent de la capacité.",
        },
        {
          question: "Mon comptable peut-il accéder aux comptes ?",
          answer:
            "Oui. Invitez-le avec le rôle Comptable. Il obtient l'accès nécessaire sans votre mot de passe, et chaque action est liée à son compte.",
        },
        {
          question: "Que se passe-t-il hors ligne ?",
          answer:
            "Les nouvelles écritures sont gardées sur l'appareil avec leur date métier d'origine. Au retour de la connexion, KontaFlow les envoie une seule fois et évite les doublons.",
        },
        {
          question: "L'IA valide-t-elle sans demander ?",
          answer:
            "Les écritures ambiguës ou inhabituelles doivent être confirmées. L'assistant propose un montant, une catégorie et une date ; vous vérifiez avant l'enregistrement.",
        },
        {
          question: "Quelles devises et quels fuseaux sont pris en charge ?",
          answer:
            "Le XAF par défaut, avec d'autres devises et un fuseau horaire par espace. Africa/Douala est le fuseau par défaut.",
        },
        {
          question: "Puis-je gérer plusieurs entreprises ?",
          answer:
            "L'architecture prend en charge plusieurs espaces par utilisateur. Votre offre détermine combien vous pouvez en garder actifs.",
        },
        {
          question: "KontaFlow est-il une banque ou un prêteur ?",
          answer:
            "Non. KontaFlow est un logiciel de comptabilité et d'intelligence d'affaires. Il ne détient pas de dépôts, ne prête pas et ne remplace pas un comptable ou conseiller fiscal agréé.",
        },
      ],
      viewAll: "Lire toutes les questions fréquentes",
    },
    finalCta: {
      title: "Donnez à chaque décision un meilleur chiffre derrière elle.",
      subtitle:
        "Créez votre espace, enregistrez une vraie transaction et voyez ce que donnent des comptes enfin réunis.",
      primary: "Commencer l'essai gratuit",
      secondary: "Parler à l'équipe",
    },
  },
  about: {
    metaTitle: "À propos de KontaFlow — la comptabilité pour l'entreprise africaine",
    metaDescription:
      "KontaFlow est une plateforme multi-locataires de comptabilité et d'intelligence d'affaires conçue pour les petites entreprises du Cameroun et d'Afrique.",
    eyebrow: "À propos",
    title: "Conçu pour les entreprises qui font tourner l'économie.",
    accent: "Et pour être compris.",
    subtitle:
      "KontaFlow est un logiciel de comptabilité pour les propriétaires, commerçants, artisans et les comptables qui les accompagnent. Il est pensé autour des appareils, canaux et contraintes des vraies entreprises africaines.",
    image: "/images/marketing/team-meeting.webp",
    imageAlt: "Deux collègues travaillant ensemble autour d’une table avec un ordinateur portable et un téléphone de conférence",
    imageCaption: "Photographie d'illustration, pas un client ni un témoignage.",
    introTitle: "Notre point de départ",
    introBody:
      "Une entreprise peut être occupée tous les jours sans savoir si elle fait du bénéfice. Les traces existent — cahiers, messages de mobile money, alertes bancaires, mémoire — mais elles ne se rencontrent jamais. KontaFlow existe pour rendre cette rencontre simple, fiable et utile.",
    sections: [
      {
        title: "Ce que nous construisons",
        body:
          "Un espace multi-locataires où l'entreprise enregistre l'argent sur le web, WhatsApp, l'USSD et hors ligne. Derrière l'interface : un livre en partie double, un système de permissions et des rapports qui respectent les mêmes chiffres.",
      },
      {
        title: "Quatre principes",
        cards: [
          {
            title: "Les comptes avant les graphiques",
            body:
              "Un graphique vaut ce que vaut l'écriture dessous. Nous construisons d'abord le livre, puis nous l'expliquons.",
          },
          {
            title: "L'appareil dans la poche",
            body:
              "Un téléphone simple et une connexion irrégulière sont la norme, pas l'exception. L'USSD, la file hors ligne et une application légère comptent.",
          },
          {
            title: "Explicable par défaut",
            body:
              "Un chiffre doit pouvoir être relié aux écritures qui l'ont produit. Les réponses de l'IA doivent renvoyer à de vrais dossiers.",
          },
          {
            title: "Vos données vous appartiennent",
            body:
              "L'isolation des locataires est appliquée dans la base. Vos comptes ne sont pas un jeu d'entraînement public.",
          },
        ],
      },
      {
        title: "Ce que KontaFlow n'est pas",
        body:
          "KontaFlow n'est ni une banque, ni un prêteur, ni un auditeur, ni un conseiller fiscal. Il ne détient pas de dépôts. Il donne à l'entreprise un dossier plus clair et de meilleures questions pour ses conseils professionnels.",
      },
      {
        title: "Où nous travaillons",
        body:
          "Le produit est conçu à Douala, au Cameroun, pour les entreprises de la région. L'interface est disponible en anglais, français et pidgin camerounais, avec le XAF par défaut et Africa/Douala comme fuseau horaire.",
      },
    ],
    cta: {
      title: "Voyez si l'espace convient à votre entreprise.",
      body: "Commencez avec l'offre gratuite et une vraie transaction. Aucune carte requise.",
      primary: "Commencer gratuitement",
      secondary: "Découvrir les fonctions",
    },
  },
  features: {
    metaTitle: "Fonctionnalités — comptabilité et intelligence d'affaires KontaFlow",
    metaDescription:
      "Comptabilité en partie double, saisie multicanal, synchronisation hors ligne, assistant IA, rapports et collaboration sécurisée dans un seul espace.",
    eyebrow: "Fonctionnalités",
    title: "Tout pour tenir des comptes propres.",
    accent: "Sans avoir à se battre.",
    subtitle:
      "Un espace pour enregistrer, vérifier et comprendre l'argent. Chaque fonction répond à une contrainte réelle : peu de données, appareils partagés, journées chargées et un comptable qui veut le détail.",
    image: "/images/marketing/finance-reports.webp",
    imageAlt: "Mains tapant sur un ordinateur portable affichant des graphiques financiers et un rapport imprimé",
    imageCaption: "Photographie d'illustration, pas un client.",
    introTitle: "Une boucle comptable complète",
    introBody:
      "Saisir la transaction, garder le justificatif, rapprocher le solde, produire le rapport et demander ce qui a changé. KontaFlow relie chaque étape au même livre.",
    sections: [
      {
        title: "Comptabilité de base",
        cards: [
          {
            title: "Livre en partie double",
            body:
              "Chaque transaction validée crée des lignes équilibrées débit-crédit. Les montants sont stockés en unités mineures entières, pas en virgule flottante.",
          },
          {
            title: "Historique immuable",
            body:
              "Les écritures validées sont figées. Une correction crée une contre-passation, donc l'original et la correction restent visibles.",
          },
          {
            title: "Plan comptable",
            body:
              "Une structure par défaut est créée avec l'espace, puis adaptée à l'entreprise.",
          },
          {
            title: "Reçus et documents",
            body:
              "Joignez les justificatifs dans un stockage privé, accessible par liens à durée limitée.",
          },
        ],
      },
      {
        title: "Tous les canaux",
        cards: [
          {
            title: "Web et application installable",
            body: "Une interface mobile-first avec installation PWA et repli hors ligne.",
          },
          {
            title: "Messages WhatsApp",
            body: "Envoyez une vente ou une dépense en langage courant et vérifiez l'écriture proposée.",
          },
          {
            title: "Menus USSD",
            body: "Enregistrez une vente, une dépense ou consultez un solde depuis un téléphone simple.",
          },
          {
            title: "File hors ligne",
            body:
              "Saisissez maintenant, synchronisez plus tard. Les dates métier et les nouvelles tentatives sans doublon sont préservées.",
          },
        ],
      },
      {
        title: "Comprendre l'entreprise",
        cards: [
          {
            title: "Rapports",
            body:
              "Résultat, trésorerie, catégories de dépenses et exports CSV pour comptables et prêteurs.",
          },
          {
            title: "Assistant IA",
            body:
              "Posez des questions en langage courant et obtenez des réponses fondées sur les dossiers autorisés.",
          },
          {
            title: "Constats d'affaires",
            body: "Voyez les changements de coûts, de marge et d'activité client avant la fin du mois.",
          },
          {
            title: "Piste d'audit",
            body: "Les actions financières enregistrent l'acteur, l'action, l'entité et l'espace.",
          },
        ],
      },
      {
        title: "Équipe et sécurité des locataires",
        cards: [
          {
            title: "Rôles et permissions",
            body:
              "Propriétaires, administrateurs, comptables, gestionnaires et personnel ont chacun une vue limitée.",
          },
          {
            title: "Isolation en base",
            body:
              "La sécurité au niveau des lignes PostgreSQL protège chaque table. Le navigateur ne peut pas choisir un autre espace en changeant un identifiant.",
          },
          {
            title: "Accès vérifié",
            body: "Vérification e-mail et téléphone, révocation des sessions et page de sécurité.",
          },
          {
            title: "Stockage privé",
            body:
              "Les documents de l'espace et les images de profil vivent dans des compartiments privés avec des politiques par locataire.",
          },
        ],
      },
    ],
    cta: {
      title: "Essayez la boucle avec vos propres chiffres.",
      body: "L'offre gratuite inclut le livre de base et tous les canaux de saisie.",
      primary: "Commencer gratuitement",
      secondary: "Voir comment ça marche",
    },
  },
  services: {
    metaTitle: "Services — installation, canaux et collaboration comptable KontaFlow",
    metaDescription:
      "Accompagnement à la création de l'espace, au branchement des canaux, à l'accès du comptable et aux rapports.",
    eyebrow: "Services",
    title: "Un logiciel pour tenir les comptes. Un soutien pour les faire avancer.",
    accent: "Sans facture de conseil.",
    subtitle:
      "KontaFlow est d'abord un produit. Autour, nous aidons concrètement avec la configuration, les canaux, les rôles et les rapports dont votre comptable a besoin.",
    image: "/images/marketing/small-business-owner.webp",
    imageAlt: "Commerçante devant son étal au marché",
    imageCaption: "Photographie d'illustration, pas un client.",
    introTitle: "Choisissez l'aide dont vous avez besoin",
    introBody:
      "La plupart des entreprises démarrent seules en quelques minutes. Si vous avez besoin d'aide pour la migration, les rôles ou les rapports, l'équipe peut intervenir sans prendre possession de vos comptes.",
    sections: [
      {
        title: "Ce que nous pouvons faire",
        cards: [
          {
            title: "Configuration de l'espace",
            body:
              "Informations de l'entreprise, devise, fuseau, exercice et plan comptable de départ.",
          },
          {
            title: "Branchement des canaux",
            body:
              "Numéros WhatsApp, explication des menus USSD et mise en place du flux hors ligne.",
          },
          {
            title: "Accès du comptable",
            body: "Invitation avec le bon rôle et présentation du pack d'export.",
          },
          {
            title: "Rôles de l'équipe",
            body: "Choisir le plus petit accès nécessaire pour les ventes, achats ou la revue.",
          },
          {
            title: "Revue des rapports",
            body:
              "Vous aider à lire le résultat, la trésorerie et les catégories avant une banque, un prêteur ou le fisc.",
          },
          {
            title: "Migration des données",
            body:
              "Planifier le transfert des clients, fournisseurs et soldes d'ouverture dans l'espace.",
          },
        ],
      },
      {
        title: "Ce que nous ne faisons pas",
        body:
          "Nous ne fournissons pas d'audit légal, de déclaration fiscale, de conseil juridique ni de comptabilité externalisée. Votre comptable reste responsable de ses conclusions professionnelles ; KontaFlow lui donne un dossier plus propre.",
      },
      {
        title: "Pour qui",
        cards: [
          {
            title: "Boutiques et commerçants",
            body:
              "Ventes quotidiennes, achats de stock, mobile money et besoin de savoir ce qui reste vraiment.",
          },
          {
            title: "Petites entreprises de services",
            body:
              "Factures, soldes clients, transport et petite équipe qui saisit depuis son téléphone.",
          },
          {
            title: "Comptables et bookkeepers",
            body:
              "Espaces clients avec accès limité, exports propres et livre qui garde son historique.",
          },
        ],
      },
    ],
    cta: {
      title: "Dites-nous où en sont vos comptes aujourd'hui.",
      body: "Envoyez un court message sur votre entreprise, vos canaux et ce que vous devez nettoyer.",
      primary: "Parlez-nous",
      secondary: "Voir les tarifs",
    },
  },
  how: {
    metaTitle: "Comment fonctionne KontaFlow — de la première écriture à la clôture",
    metaDescription:
      "Créez un espace, enregistrez l'argent par n'importe quel canal, vérifiez le livre et transformez-le en rapports et décisions.",
    eyebrow: "Comment ça marche",
    title: "D'une journée chargée à des comptes fiables.",
    accent: "En quatre étapes claires.",
    subtitle:
      "Pas de long projet. Commencez par une transaction, ajoutez les canaux que vous utilisez vraiment et laissez le livre relier le reste.",
    image: "/images/marketing/working-laptop.webp",
    imageAlt: "Entrepreneuse saisissant des transactions sur un ordinateur portable",
    imageCaption: "Photographie d'illustration, pas un client.",
    introTitle: "Une boucle, chaque jour",
    introBody:
      "KontaFlow se utilise dans les petits moments : une vente entre deux clients, une dépense confirmée en rentrant, un contrôle rapide avant la prochaine commande.",
    steps: [
      {
        title: "Créer l'espace",
        body: "Nommez l'entreprise, choisissez la devise et le fuseau, puis confirmez l'exercice.",
        detail:
          "KontaFlow prépare le plan comptable, l'adhésion propriétaire et un essai de sept jours sur Starter.",
      },
      {
        title: "Enregistrer les mouvements",
        body: "Utilisez le formulaire web, WhatsApp, l'USSD ou une saisie hors ligne.",
        detail:
          "Montant, date, catégorie et contact sont saisis. Le canal est marqué sur l'écriture.",
      },
      {
        title: "Vérifier et rapprocher",
        body: "Contrôlez l'écriture, joignez un reçu et corrigez correctement.",
        detail:
          "Les écritures validées sont réversibles, pas modifiables sur place. Chaque correction garde l'original et le motif.",
      },
      {
        title: "Lire, rapporter et décider",
        body: "Ouvrez le tableau de bord, générez un rapport ou posez une question à l'assistant.",
        detail:
          "Les chiffres viennent du même livre. Exportez-les pour un comptable, un prêteur ou votre prochaine décision.",
      },
    ],
    matrixTitle: "Quel canal pour quel moment ?",
    matrixSubtitle:
      "Les canaux sont complémentaires. Utilisez celui qui fait avancer la saisie sans ralentir l'entreprise.",
    matrix: [
      { channel: "Application web", data: "Données ou Wi-Fi", smartphone: "Navigateur", offline: "Oui, avec synchronisation" },
      { channel: "WhatsApp", data: "Données ou Wi-Fi", smartphone: "Oui", offline: "Non" },
      { channel: "USSD", data: "Aucune donnée", smartphone: "Non", offline: "Tout téléphone" },
      { channel: "PWA hors ligne", data: "Aucune jusqu'à la synchro", smartphone: "Oui", offline: "Oui" },
    ],
    sections: [
      {
        title: "Ce qu'il faut le premier jour",
        body:
          "Un nom d'entreprise, une devise, un fuseau et une vraie transaction. Ajoutez clients, fournisseurs, membres et reçus au fur et à mesure.",
      },
      {
        title: "Ce qui arrive à une transaction",
        cards: [
          {
            title: "Validée",
            body: "Le montant, la date et la catégorie sont vérifiés avant l'enregistrement.",
          },
          {
            title: "Comptabilisée",
            body: "L'écriture devient des lignes équilibrées en unités mineures entières.",
          },
          {
            title: "Visible",
            body: "Elle apparaît dans le tableau de bord, les rapports et l'audit pour les utilisateurs autorisés.",
          },
        ],
      },
      {
        title: "Quand vous êtes prêt pour plus",
        body:
          "Invitez un comptable, ajoutez un second espace sur une offre compatible, ou branchez WhatsApp et l'USSD pour le reste de l'équipe.",
      },
    ],
    cta: {
      title: "Commencez par une vraie transaction.",
      body: "Le moyen le plus rapide de comprendre KontaFlow est d'y enregistrer une vraie vente.",
      primary: "Créer votre espace",
      secondary: "Parler à l'équipe",
    },
  },
  faq: {
    metaTitle: "Questions fréquentes — KontaFlow",
    metaDescription:
      "Réponses sur les offres, canaux, la saisie hors ligne, la sécurité, l'IA, les données et l'accès du comptable.",
    eyebrow: "FAQ",
    title: "Des questions, des réponses claires.",
    subtitle:
      "Si une question manque, écrivez-nous. Nous préférons expliquer une limite que la cacher.",
    image: "/images/marketing/office-focus.webp",
    imageAlt: "Professionnelle concentrée vérifiant des chiffres sur son téléphone et son ordinateur",
    groups: [
      {
        title: "Démarrage",
        items: [
          {
            question: "Combien de temps prend la configuration ?",
            answer:
              "Quelques minutes. Inscrivez-vous, vérifiez l'e-mail et le téléphone, puis nommez l'entreprise, sa devise et son fuseau. Un plan comptable par défaut est créé.",
          },
          {
            question: "Faut-il une carte pour commencer ?",
            answer:
              "Non. Starter est gratuit et l'espace commence par un essai de sept jours. Les offres payantes sont arrangées avec l'équipe quand vous avez besoin de plus de capacité.",
          },
          {
            question: "Puis-je importer des dossiers existants ?",
            answer:
              "Vous pouvez commencer avec des soldes d'ouverture et ajouter clients et fournisseurs au fur et à mesure. Pour une migration importante, contactez-nous pour planifier les données et les dates.",
          },
          {
            question: "L'application fonctionne-t-elle en français et en pidgin ?",
            answer:
              "Oui. L'interface est disponible en anglais, français et pidgin camerounais, et l'assistant IA comprend les trois.",
          },
        ],
      },
      {
        title: "Canaux et accès",
        items: [
          {
            question: "L'USSD et WhatsApp nécessitent-ils un smartphone ?",
            answer:
              "L'USSD fonctionne sur un téléphone simple sans données. WhatsApp nécessite un smartphone ou l'application de bureau et une connexion.",
          },
          {
            question: "Que se passe-t-il si Internet tombe ?",
            answer:
              "L'application web installable peut mettre les écritures en file sur l'appareil. Elles gardent leur date métier et se synchronisent au retour de la connexion.",
          },
          {
            question: "Plusieurs personnes peuvent-elles utiliser le même espace ?",
            answer:
              "Oui. Invitez propriétaires, administrateurs, comptables, gestionnaires et personnel avec des rôles limités. Chacun utilise son propre compte.",
          },
          {
            question: "Mon comptable peut-il tout voir ?",
            answer:
              "Le rôle Comptable est conçu pour la comptabilité et les rapports. Vérifiez la description avant d'inviter et retirez l'accès quand il n'est plus nécessaire.",
          },
        ],
      },
      {
        title: "Argent et dossiers",
        items: [
          {
            question: "Comment les montants sont-ils stockés ?",
            answer:
              "En unités mineures entières avec une devise explicite, pas en virgule flottante. Cela évite les écarts d'arrondi qui font diverger les rapports.",
          },
          {
            question: "Puis-je modifier une transaction validée ?",
            answer:
              "Non. Les écritures validées sont immuables. Vous les annulez par une contre-passation, ce qui garde les deux côtés visibles.",
          },
          {
            question: "Quels rapports puis-je générer ?",
            answer:
              "Résultat, trésorerie, catégories de dépenses, ventes par client ou produit et exports CSV. Les références de documents restent attachées.",
          },
          {
            question: "Puis-je exporter mes données ?",
            answer:
              "Oui. Les rapports et transactions peuvent être exportés. Vous pouvez aussi demander une copie de vos données, sous réserve de la conservation légale.",
          },
        ],
      },
      {
        title: "Sécurité, IA et confidentialité",
        items: [
          {
            question: "Mes données sont-elles séparées des autres entreprises ?",
            answer:
              "Oui. Chaque enregistrement porte une référence d'espace, et la sécurité au niveau des lignes PostgreSQL applique la frontière dans la base, pas seulement dans l'interface.",
          },
          {
            question: "L'IA s'entraîne-t-elle sur mes comptes ?",
            answer:
              "L'assistant est conçu pour répondre à partir de vos dossiers autorisés. Vos données ne servent pas de jeu d'entraînement public. Consultez la Politique de confidentialité pour les sous-traitants.",
          },
          {
            question: "L'IA peut-elle se tromper ?",
            answer:
              "Oui. Un modèle de langage peut mal lire un montant, une catégorie ou une date. KontaFlow montre l'écriture proposée ; vous restez responsable de ce qui est validé.",
          },
          {
            question: "Où signaler un problème de sécurité ?",
            answer:
              "Écrivez à security@kontaflow.com avec assez de détail pour reproduire le problème. N'accédez pas aux données d'autrui et ne perturbez pas le service pendant le test.",
          },
        ],
      },
    ],
    cta: {
      title: "Une autre question ?",
      body: "Envoyez-la à un humain. Nous répondons sous un jour ouvré.",
      primary: "Nous contacter",
      secondary: "Lire la page sécurité",
    },
  },
  blog: {
    metaTitle: "Ressources — comptabilité pratique pour petites entreprises",
    metaDescription:
      "Des guides courts et pratiques sur la comptabilité, la trésorerie, le mobile money et les décisions financières.",
    eyebrow: "Ressources",
    title: "Des notes pratiques pour de meilleurs comptes.",
    subtitle:
      "Pas de jargon, pas de slides recyclées. Des guides courts pour propriétaires et comptables confrontés à de vraies contraintes.",
    imageAlt: "Vendeurs de marché arrangeant plantain et légumes",
    imageCaption: "Photographie d'illustration, pas un client.",
    featuredLabel: "À la une",
    readArticle: "Lire l'article",
    allArticles: "Tous les articles",
    minRead: "min de lecture",
    articles: [
      {
        slug: "separate-business-and-personal-money",
        title: "Séparer l'argent de l'entreprise et l'argent personnel sans équipe financière",
        description:
          "Un point de départ pratique pour les propriétaires qui paient les coûts de l'entreprise depuis le même portefeuille.",
        category: "Bases de la comptabilité",
        publishedAt: "2026-11-12",
        readingMinutes: 5,
        image: "/images/marketing/mobile-money.webp",
        imageAlt: "Agent de mobile money dans une petite boutique",
        intro:
          "Quand l'argent de l'entreprise et l'argent personnel partagent le même portefeuille, chaque rapport devient une supposition. Pas besoin d'un service financier pour corriger cela. Il faut une règle, un peu de séparation et une habitude qui survit à une semaine chargée.",
        sections: [
          {
            heading: "Commencez par une frontière claire",
            paragraphs: [
              "Choisissez un compte, un portefeuille mobile money ou une caisse pour les recettes et les paiements de l'entreprise. Ce n'est pas obligatoirement un compte bancaire professionnel dès le premier jour, mais ce doit être l'endroit où l'argent entre et sort.",
              "Si un client paie sur votre portefeuille personnel, transférez le montant vers le portefeuille de l'entreprise le jour même et enregistrez les deux étapes. Le transfert n'est pas une recette, c'est un mouvement entre vos propres poches.",
            ],
          },
          {
            heading: "Distinguez l'argent du propriétaire",
            paragraphs: [
              "L'argent que vous retirez pour un usage personnel n'est pas une dépense de l'entreprise. Traitez-le comme un prélèvement du propriétaire. L'argent que vous apportez est un apport. Garder ces deux étiquettes claires empêche les dépenses personnelles de réduire votre bénéfice en silence.",
            ],
            bullets: [
              "Apport : argent personnel ajouté à l'entreprise.",
              "Prélèvement : argent de l'entreprise pris pour un usage personnel.",
              "Dépense : coût engagé pour produire des recettes.",
            ],
          },
          {
            heading: "Rendez la règle facile à suivre",
            paragraphs: [
              "Placez le portefeuille de l'entreprise dans une pochette d'une autre couleur. Nommez-le clairement. Dites aux personnes qui reçoivent l'argent où l'envoyer. Une règle qui provoque une discussion au comptoir ne survivra pas.",
              "Chaque semaine, comparez le solde du portefeuille aux transactions enregistrées. S'il y a un écart, trouvez l'écriture manquante avant que l'écart ne devienne normal.",
            ],
          },
          {
            heading: "Quand tout est déjà mélangé",
            paragraphs: [
              "N'essayez pas de reconstituer chaque achat personnel. Partez d'une position d'ouverture claire aujourd'hui, enregistrez les actifs et passifs identifiables, et traitez l'historique mélangé comme un problème de migration plutôt qu'une habitude quotidienne.",
              "Votre comptable peut vous aider à présenter le solde d'ouverture. L'important est d'arrêter d'ajouter du bruit aux anciens dossiers.",
            ],
          },
        ],
        takeaway:
          "Séparer ne signifie pas multiplier les comptes. Cela signifie pouvoir dire, sans deviner, si un paiement appartenait à l'entreprise.",
      },
      {
        slug: "weekly-bookkeeping-routine",
        title: "Une routine comptable de 20 minutes par semaine pour une boutique occupée",
        description:
          "Une routine répétable pour retrouver les ventes manquantes, vérifier les dépenses et clôturer la semaine avant la panique du mois.",
        category: "Routine",
        publishedAt: "2026-10-29",
        readingMinutes: 6,
        image: "/images/marketing/market-vendors.webp",
        imageAlt: "Vendeuse rangeant ses produits au marché",
        intro:
          "La panique de fin de mois est souvent un problème de fin de semaine reporté quatre fois. Une routine courte et régulière vaut mieux qu'un tableur parfait ouvert une fois par trimestre.",
        sections: [
          {
            heading: "Choisissez 20 minutes calmes",
            paragraphs: [
              "Prenez le même créneau chaque semaine, de préférence quand la boutique est calme et que la caisse du jour est comptée. Inscrivez-le comme un vrai rendez-vous. La routine ne marche que si elle est assez ennuyeuse pour être répétée.",
            ],
          },
          {
            heading: "1. Rapprochez espèces et mobile money",
            paragraphs: [
              "Comptez la caisse et vérifiez le solde mobile money. Comparez avec les écritures de la semaine. Notez chaque écart, même petit. Une écriture manquante de 2 000 FCFA est plus facile à retrouver maintenant que dans un mois.",
            ],
          },
          {
            heading: "2. Comblez les trous",
            paragraphs: [
              "Ajoutez les ventes qui n'existent que dans la mémoire, les paiements fournisseurs restés sur un reçu de poche et les transferts entre comptes. Utilisez la date métier d'origine, pas la date du jour.",
            ],
            bullets: [
              "Vérifiez les messages mobile money non enregistrés.",
              "Vérifiez les reçus et reconnaissances de dette dans la caisse.",
              "Demandez à la personne du comptoir ce qui n'est pas expliqué.",
            ],
          },
          {
            heading: "3. Regardez trois chiffres",
            paragraphs: [
              "Regardez les recettes, les dépenses et la trésorerie de la semaine. N'essayez pas de tout analyser. Posez une question : cela correspond-il à ce que j'ai vu dans l'entreprise ?",
              "Si un chiffre semble faux, remontez aux écritures avant de modifier un rapport. Le rapport n'est qu'une vue du livre.",
            ],
          },
          {
            heading: "4. Notez la prochaine action",
            paragraphs: [
              "Terminez par une tâche concrète pour la semaine suivante : relancer un client, corriger une catégorie, joindre un reçu ou poser une question à un comptable. Une tâche suffit.",
            ],
          },
        ],
        takeaway: "Le but n'est pas une semaine parfaite. C'est une semaine que vous pouvez expliquer, clôturer et continuer.",
      },
      {
        slug: "read-cash-flow-before-profit",
        title: "Pourquoi la trésorerie peut sembler pire même quand le bénéfice est bon",
        description:
          "Une explication simple de la différence entre bénéfice et trésorerie, et trois questions à poser quand l'argent manque.",
        category: "Analyse financière",
        publishedAt: "2026-10-08",
        readingMinutes: 7,
        image: "/images/marketing/finance-reports.webp",
        imageAlt: "Gros plan sur un ordinateur portable affichant des graphiques financiers à côté d’un rapport imprimé",
        intro:
          "Une entreprise peut enregistrer un bénéfice et manquer la paie. Ce n'est pas une contradiction, c'est un problème de calendrier. Comprendre l'écart entre bénéfice et trésorerie est l'une des habitudes financières les plus utiles.",
        sections: [
          {
            heading: "Le bénéfice est une période. La trésorerie est un instant.",
            paragraphs: [
              "Le bénéfice compare les recettes aux coûts engagés pour les produire sur une période. La trésorerie suit le moment où l'argent arrive et part. Une facture payée le mois prochain peut être un bénéfice aujourd'hui et de l'argent indisponible demain.",
            ],
          },
          {
            heading: "Trois questions pour une semaine tendue",
            paragraphs: [
              "Avant d'emprunter ou de couper les coûts, séparez le problème du symptôme.",
            ],
            bullets: [
              "Qui nous doit de l'argent, et quand a-t-il promis de payer ?",
              "Qu'est-ce qui doit sortir dans les sept prochains jours, et qu'est-ce qui peut attendre ?",
              "Quelles ventes sont déjà réalisées mais pas encore encaissées ?",
            ],
          },
          {
            heading: "Regardez la tendance, pas un jour",
            paragraphs: [
              "Un vendredi calme est du bruit. Un écart qui se creuse entre ventes et encaissements sur plusieurs semaines est une tendance. Comparez la même semaine sur plusieurs mois et regardez l'âge des soldes clients impayés.",
              "Si le stock absorbe la trésorerie, vérifiez s'il se vend. Sinon, le bilan peut sembler actif alors que le compte bancaire maigrit.",
            ],
          },
          {
            heading: "Rendez la prévision assez simple pour être utilisée",
            paragraphs: [
              "Une bonne prévision de trésorerie n'a pas besoin de cent lignes. Commencez par le solde d'ouverture, les encaissements attendus, les paiements engagés et une marge pour les surprises. Mettez-la à jour chaque semaine avec de vrais chiffres.",
              "Quand la prévision montre un manque, agissez tôt : appelez le client, négociez une date fournisseur ou retardez un achat non urgent. Plus tôt vous voyez le problème, plus vous avez d'options.",
            ],
          },
        ],
        takeaway:
          "Le bénéfice dit si l'entreprise gagne. La trésorerie dit si elle peut continuer. Il faut les deux, côte à côte.",
      },
    ],
  },
  contact: {
    metaTitle: "Contacter KontaFlow",
    metaDescription:
      "Posez une question sur les tarifs, la configuration, les migrations, l'accès comptable ou une démonstration.",
    eyebrow: "Contact",
    title: "Parlez à l'équipe derrière KontaFlow.",
    subtitle:
      "Des questions sur les tarifs, la mise en place, le transfert de vos comptes ou le travail avec votre comptable ? Envoyez un message et un humain répondra.",
    image: "/images/marketing/pricing-entrepreneur.webp",
    imageAlt: "Entrepreneuse enregistrant des ventes sur un ordinateur portable et un téléphone",
    nextTitle: "Ce qui se passe ensuite",
    nextSteps: [
      "Nous lisons votre message et vérifions si nous pouvons aider directement.",
      "Si nécessaire, nous posons une ou deux questions de clarification.",
      "Vous recevez une réponse sous un jour ouvré, du lundi au vendredi.",
    ],
    email: "hello@kontaflow.com",
    privacyEmail: "privacy@kontaflow.com",
    location: "Douala, Cameroun",
    hours: "Lundi–vendredi · 8h00–18h00 WAT",
  },
  legal: legalFr,
  photoCredits: {
    title: "Crédits photo",
    intro:
      "Le site utilise de vraies photographies, dont des images CC0 de Nappy.co, sous licence Creative Commons ou équivalente. Les images sont recadrées, redimensionnées et converties en WebP. Les personnes montrées sont illustratives et ne sont pas des clients, employés ou partenaires sauf mention explicite.",
    items: [
      {
        file: "home-hero.webp",
        title: "Corporate lifestyle: Woman in the office",
        creator: "Nappy.co",
        license: "CC0 1.0",
        licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
        sourceUrl: "https://nappy.co/photo/corporate-lifestyle-woman-in-the-office%2B9eJ64SoiJH4AFSVDYRmhJ",
        note: "Recadrée, redimensionnée et convertie.",
      },
      {
        file: "team-meeting.webp",
        title: "Team meeting session",
        creator: "Nappy.co",
        license: "CC0 1.0",
        licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
        sourceUrl: "https://nappy.co/photo/office-meeting-session%2BJJXFPZ-TAjJI6JlE3qNZM",
        note: "Recadrée, redimensionnée et convertie.",
      },
      {
        file: "finance-reports.webp",
        title: "Finance reports",
        creator: "Nappy.co",
        license: "CC0 1.0",
        licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
        sourceUrl: "https://nappy.co/photo/finance-reports%2BKXs3pwXD2zxRgfJEUa0bQ",
        note: "Recadrée, redimensionnée et convertie.",
      },
      {
        file: "small-business-owner.webp",
        title: "Woman in market",
        creator: "Nappy.co",
        license: "CC0 1.0",
        licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
        sourceUrl: "https://nappy.co/photo/woman-in-market%2BrR4-0UdzyPsYo-p1o2JiY",
        note: "Recadrée, redimensionnée et convertie.",
      },
      {
        file: "working-laptop.webp",
        title: "Woman engaged in laptop work in an office",
        creator: "Nappy.co",
        license: "CC0 1.0",
        licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
        sourceUrl: "https://nappy.co/photo/woman-engaged-in-laptop-work-in-an-office%2BBnw9ZcaVXWXfCG9_vxE5l",
        note: "Recadrée, redimensionnée et convertie.",
      },
      {
        file: "office-focus.webp",
        title: "Focused female professional at the office",
        creator: "Nappy.co",
        license: "CC0 1.0",
        licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
        sourceUrl: "https://nappy.co/photo/focused-female-professional-at-the-office%2ByJocZYawPj0UjsLWedjAF",
        note: "Recadrée, redimensionnée et convertie.",
      },
      {
        file: "office-gadgets.webp",
        title: "Professional woman surrounded by office gadgets",
        creator: "Nappy.co",
        license: "CC0 1.0",
        licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
        sourceUrl: "https://nappy.co/photo/professional-woman-surrounded-by-office-gadgets%2BKndWXt0ceyVNo3VriKxlE",
        note: "Recadrée, redimensionnée et convertie.",
      },
      {
        file: "pricing-entrepreneur.webp",
        title: "Female entrepreneur using laptop",
        creator: "Nappy.co",
        license: "CC0 1.0",
        licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
        sourceUrl: "https://nappy.co/photo/female-entrepreneur-using-laptop%2BHNuSZewwSTsVZw50X2UOH",
        note: "Recadrée, redimensionnée et convertie.",
      },
      {
        file: "security-home-office.webp",
        title: "Woman in home office",
        creator: "Nappy.co",
        license: "CC0 1.0",
        licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
        sourceUrl: "https://nappy.co/photo/woman-in-home-office%2BoL881xHmvxb1niG-nO6ie",
        note: "Recadrée, redimensionnée et convertie.",
      },
      {
        file: "market-vendor-phone.webp",
        title: "Nigeria art market",
        creator: "Nappy.co",
        license: "CC0 1.0",
        licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
        sourceUrl: "https://nappy.co/photo/nigeria-art-market%2BJkiGp3iKQybmb5rQucbVN",
        note: "Recadrée, redimensionnée et convertie.",
      },
      {
        file: "business-notes.webp",
        title: "Business composition",
        creator: "Nappy.co",
        license: "CC0 1.0",
        licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
        sourceUrl: "https://nappy.co/photo/business-composition%2BTUnoaQicaiZ9-PAk0JNon",
        note: "Recadrée, redimensionnée et convertie.",
      },
      {
        file: "analysis-report.webp",
        title: "Analysis report",
        creator: "Nappy.co",
        license: "CC0 1.0",
        licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
        sourceUrl: "https://nappy.co/photo/analysis-report%2B9_Q-F6pqP3Ge_wkmtA-7n",
        note: "Recadrée, redimensionnée et convertie.",
      },
      {
        file: "market-douala.webp",
        title: "Rue du marché Mboppi à Douala",
        creator: "Johnkekam",
        license: "CC BY-SA 4.0",
        licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
        sourceUrl: "https://commons.wikimedia.org/wiki/File:Rue_du_march%C3%A9_Mboppi_%C3%A0_Douala.jpg",
        note: "Redimensionnée et convertie.",
      },
      {
        file: "mobile-money.webp",
        title: "Mobile money outlet",
        creator: "Ndiwulira",
        license: "CC BY-SA 4.0",
        licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
        sourceUrl: "https://commons.wikimedia.org/wiki/File:Mobile_money_outlet.jpg",
        note: "Redimensionnée et convertie.",
      },
      {
        file: "market-vendors.webp",
        title: "Bayam Sellam woman selling green banana and ripe plantain",
        creator: "Minette Lontsie",
        license: "CC BY-SA 4.0",
        licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
        sourceUrl: "https://commons.wikimedia.org/wiki/File:Bayam_Sellam_woman_selling_green_banana_and_ripe_plantain.jpg",
        note: "Redimensionnée et convertie.",
      },
      {
        file: "phone-feature.webp",
        title: "Rachel Holding a Mobile Phone",
        creator: "whiteafrican (Erik Hersman)",
        license: "CC BY 2.0",
        licenseUrl: "https://creativecommons.org/licenses/by/2.0/",
        sourceUrl: "https://www.flickr.com/photos/18288598@N00/2735720397",
        note: "Recadrée et redimensionnée.",
      },
    ],
  },
};
