import type { LegalDoc } from "./types";

export const legalFr: LegalDoc[] = [
  {
    slug: "terms",
    title: "Conditions d'utilisation",
    description:
      "Les règles d'utilisation de KontaFlow, vos responsabilités et les limites du service.",
    updated: "En vigueur le 1er janvier 2026",
    intro:
      "Ces conditions régissent votre utilisation de KontaFlow. En créant un compte ou en utilisant le service, vous les acceptez. Si vous ne les acceptez pas, n'utilisez pas le service.",
    sections: [
      {
        heading: "1. Le service",
        paragraphs: [
          "KontaFlow est un logiciel de comptabilité et d'intelligence d'affaires pour les entreprises. Ce n'est ni une banque, ni un prêteur, ni un auditeur, ni un conseiller fiscal, ni un cabinet comptable agréé. Il ne détient pas de dépôts et ne fournit pas de conseil financier.",
          "Certaines fonctions dépendent de fournisseurs tiers : e-mail, SMS, WhatsApp, USSD, hébergement et IA. La disponibilité peut varier selon le pays, le réseau et le déploiement.",
        ],
      },
      {
        heading: "2. Comptes et autorité",
        paragraphs: [
          "Vous devez avoir au moins 18 ans et être capable de conclure un contrat. Fournissez des informations d'inscription exactes et gardez vos coordonnées à jour.",
          "Vous êtes responsable de l'activité de votre compte et de la sécurité de vos identifiants. Prévenez-nous rapidement si vous pensez que votre compte a été compromis. Ne partagez pas un même identifiant entre plusieurs personnes : invitez-les avec leurs propres rôles.",
        ],
      },
      {
        heading: "3. Votre espace et vos données",
        paragraphs: [
          "Vous possédez les dossiers que vous placez dans KontaFlow. Vous nous autorisez à les héberger, les traiter et les afficher uniquement pour fournir le service, le sécuriser et respecter la loi.",
          "Vous êtes responsable de l'exactitude et de la légalité de vos dossiers, du droit de les importer et de la vérification des écritures avant validation. Conservez vos propres copies des documents légalement obligatoires.",
        ],
      },
      {
        heading: "4. Utilisation acceptable",
        paragraphs: [
          "Vous devez utiliser KontaFlow de manière licite et respecter les données d'autrui et l'intégrité du service. La Politique d'utilisation acceptable fait partie de ces conditions.",
        ],
      },
      {
        heading: "5. Offres, essais et paiement",
        paragraphs: [
          "L'offre Starter est un essai de 14 jours sans frais. À la fin de l'essai, l'espace passe en lecture seule jusqu'au choix d'une offre payante. Les offres payantes sont aux prix affichés sur la page Tarifs et sont arrangées avec l'équipe.",
          "Les prix sont indiqués en FCFA et peuvent être soumis à des taxes. Nous expliquons le montant et la période de facturation avant l'activation d'une offre payante. La résiliation et les remboursements sont décrits dans la Politique de remboursement et de résiliation.",
        ],
      },
      {
        heading: "6. Assistance IA",
        paragraphs: [
          "L'assistant IA peut mal comprendre une langue, un montant, une date ou une catégorie. Il peut produire une réponse plausible mais fausse. Vous devez vérifier les écritures proposées et les chiffres importants avant de vous y fier.",
          "La sortie de l'IA aide à décider ; elle ne remplace pas votre comptable, conseiller fiscal, auditeur ou prêteur.",
        ],
      },
      {
        heading: "7. Disponibilité et responsabilité",
        paragraphs: [
          "Nous travaillons à maintenir le service disponible et sécurisé, mais nous ne promettons pas un fonctionnement ininterrompu ou sans erreur. La maintenance, les pannes réseau et les interruptions de tiers peuvent affecter l'accès.",
          "Dans la mesure permise par la loi, nous ne sommes pas responsables des pertes indirectes, des bénéfices manqués ou des données perdues faute de sauvegarde de votre part. Aucune clause ne limite les droits qui ne peuvent l'être par la loi.",
        ],
      },
      {
        heading: "8. Suspension, résiliation et modifications",
        paragraphs: [
          "Nous pouvons suspendre ou résilier l'accès en cas de manquement grave, d'usage illicite, de non-paiement ou de risque de sécurité. Lorsque cela est raisonnable, nous donnons un préavis et la possibilité d'exporter les données.",
          "Vous pouvez arrêter d'utiliser le service à tout moment. Nous pouvons modifier ces conditions ; les changements importants seront communiqués avant leur entrée en vigueur.",
        ],
      },
      {
        heading: "9. Contact",
        paragraphs: [
          "Questions sur ces conditions : info@kontaflow.com. Confidentialité : privacy@kontaflow.com. Sécurité : security@kontaflow.com.",
        ],
      },
    ],
  },
  {
    slug: "privacy",
    title: "Politique de confidentialité",
    description:
      "Les données personnelles collectées par KontaFlow, leur utilisation, leur conservation et vos choix.",
    updated: "En vigueur le 1er janvier 2026 · version 2026-01-01",
    intro:
      "Cette politique explique comment KontaFlow traite les données personnelles dans l'application web, l'USSD, WhatsApp et l'assistant IA. Elle s'applique aux titulaires de compte, aux membres d'un espace et aux personnes qui nous contactent.",
    sections: [
      {
        heading: "1. Qui est responsable",
        paragraphs: [
          "Pour les données de compte, de facturation et du site, KontaFlow agit comme responsable du traitement. Pour les dossiers métier importés dans un espace, l'entreprise est responsable et KontaFlow agit comme sous-traitant sur ses instructions.",
          "Contact : privacy@kontaflow.com.",
        ],
      },
      {
        heading: "2. Données collectées",
        paragraphs: [
          "Nous collectons l'identité et les coordonnées (nom, e-mail, téléphone, pays, langue), les données d'authentification, le profil de l'entreprise, les transactions, clients, fournisseurs, documents, messages adressés à l'assistant, identifiants de canal, journaux de sécurité et preuves de consentement.",
          "Les codes de vérification téléphonique ne sont conservés que sous forme de hachage à clé. Nous ne stockons pas le code en clair. Les coordonnées de paiement, lorsqu'une offre payante est arrangée, sont traitées par le prestataire de paiement.",
        ],
      },
      {
        heading: "3. Pourquoi nous les utilisons",
        paragraphs: [
          "Nous utilisons les données pour fournir et sécuriser le service, tenir les livres, produire des rapports, faire fonctionner l'assistant IA, communiquer sur le compte, prévenir les abus, respecter nos obligations et améliorer le produit.",
          "Selon le cas, le traitement repose sur l'exécution du contrat, le respect de la loi, la protection d'intérêts vitaux ou publics, ou notre intérêt légitime à exploiter un service sûr. Le consentement marketing est séparé et facultatif.",
        ],
      },
      {
        heading: "4. Partage et sous-traitants",
        paragraphs: [
          "Nous ne vendons pas les données personnelles. Nous partageons uniquement le nécessaire avec les fournisseurs qui soutiennent le service : hébergement et base de données, e-mail, SMS et USSD, WhatsApp, traitement IA, sécurité et support.",
          "Les sous-traitants sont tenus à des obligations de confidentialité et de protection des données. Nous pouvons divulguer des données si la loi l'exige, pour protéger des droits ou la sécurité, ou dans le cadre d'une véritable transmission d'entreprise avec des garanties appropriées.",
        ],
      },
      {
        heading: "5. Transferts internationaux",
        paragraphs: [
          "Certains fournisseurs traitent des données hors du Cameroun. Lorsque la loi l'exige, nous utilisons des garanties contractuelles et organisationnelles. Vous pouvez nous demander des informations sur les garanties applicables à vos données.",
        ],
      },
      {
        heading: "6. Conservation",
        paragraphs: [
          "Nous conservons les données de compte pendant la durée d'activité et une période raisonnable après. Les dossiers financiers peuvent être conservés pendant la durée exigée par les règles comptables, fiscales, antifraude et de preuve.",
          "Les codes de vérification expirent après dix minutes. Les journaux de sécurité sont conservés le temps nécessaire aux enquêtes et à la sécurité. Les données inutiles sont supprimées ou anonymisées.",
        ],
      },
      {
        heading: "7. Vos choix et droits",
        paragraphs: [
          "Vous pouvez accéder, corriger, exporter ou supprimer vos données, retirer votre consentement marketing, vous opposer à certains traitements et demander une limitation. Certains droits sont limités par la conservation légale ou les droits d'autrui.",
          "Écrivez à privacy@kontaflow.com. Une vérification d'identité peut être nécessaire. Si vous êtes membre d'un espace, contactez d'abord l'entreprise qui le détient ; nous l'assisterons comme sous-traitant.",
        ],
      },
      {
        heading: "8. Sécurité",
        paragraphs: [
          "Nous utilisons l'isolation des locataires, les rôles, le chiffrement en transit, le hachage des codes, les journaux d'audit et le moindre privilège. Aucun système n'est parfaitement sûr : utilisez un mot de passe unique et solide et signalez tout problème à security@kontaflow.com.",
        ],
      },
      {
        heading: "9. Enfants et modifications",
        paragraphs: [
          "Le service est destiné aux entreprises et ne vise pas les enfants. Ne créez pas de compte pour un enfant.",
          "Nous pouvons mettre à jour cette politique. Les changements importants seront communiqués avant leur entrée en vigueur. La date de version en haut identifie la politique en vigueur.",
        ],
      },
    ],
  },
  {
    slug: "cookies",
    title: "Politique de cookies",
    description:
      "Les cookies et stockages locaux utilisés par KontaFlow, leur utilité et leur contrôle.",
    updated: "En vigueur le 1er janvier 2026",
    intro:
      "Les cookies et stockages similaires permettent de mémoriser votre session, votre langue et vos préférences. Cette politique décrit ce que nous utilisons aujourd'hui.",
    sections: [
      {
        heading: "1. Qu'est-ce qu'un cookie",
        paragraphs: [
          "Un cookie est un petit fichier enregistré par votre navigateur. Le stockage local est une fonction similaire qui garde des préférences sur votre appareil. Ce ne sont pas des programmes autonomes.",
        ],
      },
      {
        heading: "2. Cookies essentiels",
        paragraphs: [
          "KontaFlow utilise des cookies essentiels pour l'authentification et la sécurité. Le cookie de session Supabase vous garde connecté et protège les requêtes. Sans lui, le tableau de bord ne peut pas fonctionner.",
          "Nous utilisons aussi un cookie de langue et un cookie d'espace pour mémoriser vos choix. Bloquer ces cookies peut casser la connexion, la langue ou le changement d'espace.",
        ],
      },
      {
        heading: "3. Stockage des préférences",
        paragraphs: [
          "Votre choix de thème clair, sombre ou système est enregistré dans le navigateur. L'application installable peut mettre en cache des fichiers pour fonctionner hors ligne.",
        ],
      },
      {
        heading: "4. Analyse et publicité",
        paragraphs: [
          "Le produit actuel n'utilise pas de cookies publicitaires ni de suivi comportemental tiers. Si nous ajoutons une analyse nécessitant un consentement, nous mettrons cette politique à jour et demanderons votre accord avant tout cookie non essentiel.",
        ],
      },
      {
        heading: "5. Gérer les cookies",
        paragraphs: [
          "Vous pouvez supprimer ou bloquer les cookies dans les réglages de votre navigateur. Bloquer les cookies essentiels peut vous déconnecter ou empêcher l'accès au tableau de bord.",
          "Questions : privacy@kontaflow.com.",
        ],
      },
    ],
  },
  {
    slug: "data-processing",
    title: "Informations sur le traitement des données",
    description:
      "Comment KontaFlow traite les données d'un espace, y compris la sécurité, les sous-traitants et les incidents.",
    updated: "En vigueur le 1er janvier 2026",
    intro:
      "Cette page résume la relation de traitement lorsqu'une entreprise utilise KontaFlow pour tenir ses livres. Elle s'adresse aux propriétaires d'espaces, comptables et équipes d'achat.",
    sections: [
      {
        heading: "1. Rôles",
        paragraphs: [
          "L'entreprise qui détient un espace décide des données et des finalités. Elle est responsable du traitement. KontaFlow est sous-traitant et agit selon des instructions documentées pour fournir le service.",
          "Pour les données de compte, de site et de facturation, KontaFlow agit comme responsable ainsi que décrit dans la Politique de confidentialité.",
        ],
      },
      {
        heading: "2. Périmètre",
        paragraphs: [
          "Nous traitons les dossiers métier, coordonnées, transactions, documents importés, messages de canal et journaux d'usage pour la comptabilité, les rapports, l'assistant IA, la sécurité et le support. Nous n'utilisons pas les dossiers d'un espace pour l'entraînement public d'un modèle.",
        ],
      },
      {
        heading: "3. Mesures de sécurité",
        paragraphs: [
          "Les mesures comprennent l'isolation des locataires par sécurité au niveau des lignes PostgreSQL, les rôles limités, l'autorisation côté serveur, le stockage privé, le chiffrement en transit, le hachage des codes, les journaux d'audit, les limites de débit et le moindre privilège.",
          "Aucun programme n'élimine tout risque. Les propriétaires doivent utiliser des identifiants uniques et solides, revoir les accès et conserver leurs documents importants.",
        ],
      },
      {
        heading: "4. Sous-traitants",
        paragraphs: [
          "Le service s'appuie sur Supabase (hébergement et base de données), Vercel et Cloudflare (déploiement et diffusion), Resend (e-mail), Africa's Talking (SMS et USSD), Meta et ses prestataires approuvés (WhatsApp), et OpenAI (IA).",
          "Les fournisseurs activés peuvent varier selon le déploiement. Nous exigeons des engagements appropriés de confidentialité et de protection des données et communiquons les changements importants.",
        ],
      },
      {
        heading: "5. Incident",
        paragraphs: [
          "Si nous prenons connaissance d'une violation de données personnelles touchant un espace, nous informons le propriétaire sans délai injustifié et fournissons les informations raisonnablement nécessaires. Nous enquêtons, contenons et documentons l'incident.",
        ],
      },
      {
        heading: "6. Assistance, export et suppression",
        paragraphs: [
          "Nous fournissons des fonctions et du support pour aider un espace à répondre aux demandes d'accès, de correction, d'export et de suppression. À la fin du service, le propriétaire peut exporter ses dossiers avant la fermeture, sous réserve de la conservation légale.",
          "Un accord de traitement signé peut être demandé à privacy@kontaflow.com.",
        ],
      },
    ],
  },
  {
    slug: "refunds",
    title: "Politique de remboursement et de résiliation",
    description:
      "Le fonctionnement de l'essai, des offres payantes, de la résiliation et des demandes de remboursement.",
    updated: "En vigueur le 1er janvier 2026",
    intro:
      "Cette politique explique ce qui se passe lorsque vous arrêtez une offre, changez d'offre ou pensez qu'un débit est erroné. Elle ne réduit pas les droits accordés par la loi applicable aux consommateurs.",
    sections: [
      {
        heading: "1. Essai Starter",
        paragraphs: [
          "Starter est un essai de 14 jours à 0 FCFA. Aucun paiement n'est requis pour commencer et l'essai ne crée pas automatiquement un débit de carte. À la fin de l'essai, l'espace passe en lecture seule jusqu'à l'activation d'une offre payante.",
        ],
      },
      {
        heading: "2. Offres payantes",
        paragraphs: [
          "Growth et Scale sont des offres mensuelles en FCFA. Avant l'activation d'une offre payante, nous confirmons l'offre, le prix, la devise, la période et les taxes applicables.",
          "Les offres payantes sont arrangées avec l'équipe pendant le déploiement de la facturation en ligne. Vous ne serez pas débité par le produit sans cette confirmation.",
        ],
      },
      {
        heading: "3. Résiliation",
        paragraphs: [
          "Vous pouvez demander la résiliation d'une offre payante à tout moment en écrivant à info@kontaflow.com. Sauf accord contraire, la résiliation arrête la prochaine période et vous gardez l'accès jusqu'à la fin de la période déjà payée.",
          "La résiliation ne supprime pas automatiquement l'espace. Vous pouvez exporter vos dossiers et demander la suppression selon la Politique de confidentialité.",
        ],
      },
      {
        heading: "4. Remboursements",
        paragraphs: [
          "En cas de double débit, de montant erroné ou de débit après une résiliation confirmée, contactez-nous : nous enquêterons et corrigerons une véritable erreur.",
          "Les remboursements pour changement d'avis sur une période déjà utilisée sont examinés au cas par cas et ne sont pas garantis. Les droits plus forts prévus par la loi consommateur s'appliquent.",
        ],
      },
      {
        heading: "5. Demander de l'aide",
        paragraphs: [
          "Écrivez à info@kontaflow.com avec le nom de l'espace, la date du débit, le montant et le motif. N'envoyez pas de numéro de carte complet ni de mot de passe. Nous confirmerons la prochaine étape et le délai après examen.",
        ],
      },
    ],
  },
  {
    slug: "acceptable-use",
    title: "Politique d'utilisation acceptable",
    description:
      "Les règles de conduite et de contenu qui protègent KontaFlow, ses utilisateurs et leurs données.",
    updated: "En vigueur le 1er janvier 2026",
    intro:
      "KontaFlow traite des dossiers financiers et des données personnelles. Cette politique fixe le standard minimal d'utilisation. Elle s'applique à chaque membre d'un espace et à toute personne agissant pour lui.",
    sections: [
      {
        heading: "1. Utiliser le service légalement",
        paragraphs: [
          "N'utilisez pas KontaFlow pour la fraude, le vol, le blanchiment, le financement du terrorisme, le contournement de sanctions, la corruption ou toute autre activité illicite. Ne l'utilisez pas pour dissimuler l'origine ou la propriété de fonds.",
        ],
      },
      {
        heading: "2. Protéger les dossiers",
        paragraphs: [
          "Ne créez pas de transactions fausses ou trompeuses, ne modifiez pas les dates pour tromper, ne supprimez pas les preuves d'audit et n'utilisez pas l'identité d'autrui. Les corrections doivent suivre le processus de contre-passation du produit.",
          "N'importez pas de logiciel malveillant, ne tentez pas de contourner les contrôles, de sonder un autre espace, d'extraire massivement le service, de le surcharger ou d'altérer sa sécurité.",
        ],
      },
      {
        heading: "3. Respecter les personnes et leurs données",
        paragraphs: [
          "N'importez que des données personnelles que vous avez le droit d'utiliser. Respectez la vie privée, la confidentialité et la propriété intellectuelle. N'utilisez pas les coordonnées pour du spam ou du marketing illicite.",
        ],
      },
      {
        heading: "4. Règles des canaux",
        paragraphs: [
          "Pour WhatsApp, SMS, USSD ou e-mail, respectez les politiques du fournisseur et la loi locale. N'envoyez pas de messages illicites, harcelants ou trompeurs et n'usurpez pas l'identité d'une personne ou d'une entreprise.",
        ],
      },
      {
        heading: "5. Utilisation de l'IA",
        paragraphs: [
          "N'utilisez pas l'assistant pour produire du contenu illicite, tenter une injection de consignes, extraire les données d'un autre locataire ou contourner les permissions. Vérifiez les sorties avant de les comptabiliser.",
        ],
      },
      {
        heading: "6. Application et signalement",
        paragraphs: [
          "Nous pouvons enquêter sur un abus suspecté, limiter l'accès ou suspendre un espace pour protéger les utilisateurs, le service ou le public. Les cas graves peuvent être signalés à l'autorité compétente.",
          "Signalez un abus ou un problème de sécurité à security@kontaflow.com, sans accéder à des données qui ne vous appartiennent pas.",
        ],
      },
    ],
  },
];
