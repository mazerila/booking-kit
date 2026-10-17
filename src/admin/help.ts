/**
 * The admin guide, shown in the Help section of the admin (French and English).
 * Blocks: a string is a paragraph; `{ list }` a bullet list; `{ steps }` a numbered
 * list; `{ tip }` a highlighted note. `**bold**` is supported. Links to other
 * sections: `[text](#/help/section-id)`.
 */

export type HelpBlock = string | { list: string[] } | { steps: string[] } | { tip: string };
export type HelpSection = { id: string; title: string; summary: string; blocks: HelpBlock[] };

const fr: HelpSection[] = [
  {
    id: "start",
    title: "Premiers pas",
    summary: "Se connecter, s'y retrouver, installer l'admin sur votre téléphone.",
    blocks: [
      "Cet espace sert à gérer vos rendez-vous : ceux que vos clients prennent en ligne et ceux que vous ajoutez vous-même (téléphone, WhatsApp, en direct). Tout ce que vous modifiez ici est appliqué immédiatement sur votre site.",
      "**Se connecter.** Utilisez « Continuer avec Google » si votre adresse est un compte Google, ou demandez un lien de connexion par e-mail : ouvrez-le sur le même appareil et vous êtes connectée. Seules les adresses autorisées lors de l'installation ont accès à cet espace.",
      { tip: "Sur téléphone, ajoutez l'admin à votre écran d'accueil pour l'ouvrir comme une application : dans Safari, bouton Partager → « Sur l'écran d'accueil » ; dans Chrome, menu ⋮ → « Ajouter à l'écran d'accueil »." },
      "**Les rubriques :**",
      {
        list: [
          "**Agenda** : les demandes à traiter, les rendez-vous du jour et des deux prochaines semaines.",
          "**Calendrier** : vue jour, semaine ou mois. Cliquez sur un créneau vide pour ajouter un rendez-vous.",
          "**Clients** : la liste de vos clients, leur historique et vos notes.",
          "**Prestations** : ce que vos clients peuvent réserver, avec durées et tarifs.",
          "**Disponibilités** : vos horaires, vos congés et les règles de réservation.",
          "**Apparence** : les couleurs et polices des pages de réservation.",
          "**Réglages** : votre activité, la zone de déplacement, les confirmations, les e-mails, le formulaire.",
          "**Aide** : ce guide.",
        ],
      },
      "Sur téléphone, les quatre premières rubriques sont en bas de l'écran ; les autres sont dans « Plus ».",
    ],
  },
  {
    id: "agenda",
    title: "L'agenda au quotidien",
    summary: "Les demandes à confirmer, les rendez-vous du jour et à venir.",
    blocks: [
      "L'Agenda est la page d'accueil. Elle montre, dans l'ordre :",
      {
        list: [
          "**Demandes à traiter** (si vous en avez) : les réservations en attente de votre accord. Cliquez sur **Confirmer** ou **Refuser** ; le client reçoit un e-mail automatiquement.",
          "**Aujourd'hui** : vos rendez-vous du jour, avec l'heure, le nom, la prestation et la ville pour les soins à domicile.",
          "**À venir** : les deux semaines suivantes, jour par jour.",
        ],
      },
      "Cliquez sur un rendez-vous pour ouvrir sa fiche (voir [Gérer un rendez-vous](#/help/booking)).",
      { tip: "Les nouvelles réservations vous sont aussi envoyées par e-mail (adresses réglables dans Réglages → Notifications). Vous pouvez aussi les voir dans l'agenda de votre téléphone : voir [Synchroniser avec mon agenda](#/help/sync)." },
    ],
  },
  {
    id: "booking",
    title: "Gérer un rendez-vous",
    summary: "Contacter le client, confirmer, déplacer, annuler, prendre des notes.",
    blocks: [
      "La fiche d'un rendez-vous s'ouvre sur le côté. Elle contient :",
      {
        list: [
          "Le **statut**, la prestation, la date, la durée, le tarif, l'adresse (soins à domicile) et la distance depuis votre point de départ.",
          "Les coordonnées et les **réponses au formulaire** (par exemple la semaine de grossesse).",
          "Des boutons rapides : **Appeler**, **SMS**, **WhatsApp**, **Itinéraire** (ouvre Google Maps vers l'adresse du client).",
        ],
      },
      "**Les statuts :**",
      {
        list: [
          "**À confirmer** : une demande qui attend votre réponse. Le créneau est déjà réservé pour éviter qu'un autre client le prenne.",
          "**Confirmé** : le rendez-vous est validé.",
          "**Terminé** : le rendez-vous a eu lieu. C'est automatique quelques heures après la fin ; vous pouvez aussi le faire vous-même.",
          "**Absent** : le client n'est pas venu. Utile pour garder une trace.",
          "**Annulé** / **Refusé** : le créneau est libéré.",
        ],
      },
      "**Déplacer** : choisissez un nouveau jour, puis un créneau libre proposé, ou tapez une autre heure. Si l'heure chevauche un autre rendez-vous, un message vous prévient et vous pouvez « Enregistrer quand même ».",
      "**Annuler** : demande une confirmation, puis libère le créneau.",
      "**Prévenir le client par e-mail** : cochée par défaut. Décochez-la si vous avez déjà prévenu le client autrement. Si le client n'a pas d'e-mail (rendez-vous pris par téléphone), pensez à le prévenir vous-même.",
      "**Notes privées** : visibles uniquement par vous, jamais par le client. Pratique pour « allergie à… », « code de la porte », etc.",
      "**Historique** : qui a fait quoi et quand (création, confirmation, déplacement…).",
    ],
  },
  {
    id: "new-booking",
    title: "Ajouter un rendez-vous",
    summary: "Pour une réservation prise par téléphone, message ou en direct.",
    blocks: [
      "Deux façons de commencer : le bouton **+ Nouveau rendez-vous** dans l'Agenda, ou un **clic sur un créneau vide** dans le Calendrier (la date et l'heure sont alors préremplies).",
      {
        steps: [
          "Choisissez la **prestation**.",
          "Choisissez le **jour**, puis un **créneau libre** proposé, ou tapez l'heure de votre choix. Vous pouvez ajouter un rendez-vous en dehors de vos horaires habituels.",
          "**Client** : tapez quelques lettres du nom, de l'e-mail ou du téléphone pour retrouver un client existant ; sinon remplissez « Nouveau client » (le nom suffit).",
          "Pour un soin à domicile, indiquez l'**adresse** (celle du dernier rendez-vous est reprise pour un client existant).",
          "Choisissez le **statut** (Confirmé, ou À confirmer), ajoutez une note si besoin.",
          "Si le client a un e-mail, cochez « Prévenir le client » pour qu'il reçoive la confirmation et l'invitation d'agenda.",
          "Cliquez sur **Créer le rendez-vous**.",
        ],
      },
      { tip: "Un rendez-vous ajouté ici bloque le créneau sur le site immédiatement : personne ne pourra le réserver en ligne." },
    ],
  },
  {
    id: "calendar",
    title: "Le calendrier",
    summary: "Vues jour, semaine, mois et codes couleur.",
    blocks: [
      "Changez de vue avec **Jour / Semaine / Mois**, naviguez avec les flèches, revenez à aujourd'hui avec « Aujourd'hui ». Sur téléphone, la vue Jour s'ouvre par défaut.",
      {
        list: [
          "**Fond blanc** : vos heures d'ouverture. **Fond gris** : fermé.",
          "**Zone hachurée** : un créneau que vous avez bloqué (voir [Disponibilités](#/help/availability)).",
          "**Rendez-vous coloré** : confirmé. **Jaune** : à confirmer. **Pâle** : terminé.",
          "**Trait rouge** : l'heure actuelle.",
        ],
      },
      "Cliquez sur un rendez-vous pour ouvrir sa fiche, ou sur un espace vide pour en ajouter un. En vue Mois, cliquez sur un jour pour l'ouvrir en vue Jour.",
    ],
  },
  {
    id: "clients",
    title: "Clients",
    summary: "Retrouver un client, son historique, vos notes, exporter la liste.",
    blocks: [
      "La liste se remplit toute seule à chaque réservation (un client = une adresse e-mail, ou un numéro de téléphone pour les rendez-vous ajoutés sans e-mail).",
      {
        list: [
          "**Rechercher** par nom, e-mail ou téléphone.",
          "Cliquez sur un client pour voir ses coordonnées, sa dernière adresse, **tous ses rendez-vous** et vos **notes** à son sujet.",
          "**Nouveau rendez-vous** depuis sa fiche : le client est déjà sélectionné.",
          "**Exporter (CSV)** : télécharge la liste (s'ouvre dans Excel, Numbers ou Google Sheets).",
        ],
      },
      { tip: "Les données de vos clients sont personnelles : ne partagez pas l'export et supprimez-le après usage (RGPD)." },
    ],
  },
  {
    id: "services",
    title: "Prestations",
    summary: "Créer, modifier, ordonner et masquer ce qui est réservable.",
    blocks: [
      "Les prestations apparaissent sur le site dans l'ordre de cette page, regroupées par catégorie. Utilisez ↑ ↓ pour les ordonner.",
      "**Les champs d'une prestation :**",
      {
        list: [
          "**Nom** et **Description** : dans chaque langue du site.",
          "**Catégorie** : pour regrouper (ex. Corps, Visage, Maternité). Les catégories se créent en bas de la page.",
          "**Lieu** : au cabinet (l'adresse du cabinet est indiquée au client), **à domicile** (le client donne son adresse, qui est vérifiée par rapport à votre zone) ou en ligne.",
          "**Durée** : la durée du soin. C'est elle qui définit la place prise dans l'agenda.",
          "**Prix** et **Ancien prix** : l'ancien prix s'affiche barré (offre). Laissez le prix vide pour « Sur demande », mettez 0 pour « Gratuit ».",
          "**Battement avant / après** : un temps libre gardé autour du soin (installation, rangement). Exemple : 15 min après un soin visage.",
          "**Badge** : une petite étiquette, ex. « Nouveau » ou « Offre découverte ».",
          "**Proposée en ligne** : décochez pour **masquer** une prestation sans la supprimer (elle reste disponible quand vous ajoutez un rendez-vous vous-même).",
        ],
      },
      { tip: "Modifier un prix ou une durée ne change pas les rendez-vous déjà pris : ils gardent les conditions du moment de la réservation." },
      "**Supprimer** une prestation est définitif ; préférez la masquer si vous pensez la reproposer.",
    ],
  },
  {
    id: "availability",
    title: "Disponibilités",
    summary: "Horaires, congés, créneaux bloqués et règles de réservation.",
    blocks: [
      "**Horaires de la semaine.** Cochez les jours travaillés et indiquez une ou plusieurs plages par jour (ex. 9:00–12:30 et 14:00–19:00). Cliquez sur **Enregistrer** en haut de la section.",
      "**Jours particuliers.** Pour un jour férié, des congés ou des horaires exceptionnels : choisissez la date, puis « Fermé toute la journée » ou « Horaires spéciaux ». Pour plusieurs jours de congés, ajoutez chaque jour, ou utilisez plutôt un créneau bloqué.",
      "**Créneaux bloqués.** Pour rendre une période indisponible : une course, un rendez-vous personnel, une semaine de vacances (du lundi 00:00 au dimanche 23:59). Ces heures ne sont plus proposées en ligne.",
      "**Règles de réservation :**",
      {
        list: [
          "**Intervalle des créneaux** : les heures proposées (toutes les 30 min : 9:00, 9:30, 10:00…).",
          "**Délai minimum** : par exemple 12 h = impossible de réserver pour dans moins de 12 heures.",
          "**Réservation jusqu'à** : combien de jours à l'avance on peut réserver (ex. 60).",
          "**Maximum par jour** : au-delà, la journée est complète (0 = pas de limite).",
          "**Temps de trajet** : ajouté avant et après chaque soin à domicile pour vous laisser le temps de vous déplacer.",
        ],
      },
      { tip: "Pour arrêter temporairement les réservations en ligne, bloquez la période concernée, ou masquez les prestations dans Prestations." },
    ],
  },
  {
    id: "appearance",
    title: "Apparence",
    summary: "Choisir un style, des couleurs et des polices pour les pages de réservation.",
    blocks: [
      "Cette page change l'apparence de la page de réservation et de la page « gérer mon rendez-vous » sur votre site, ainsi que la couleur des boutons dans les e-mails.",
      {
        steps: [
          "Choisissez un **style** : « Design du site » garde les couleurs prévues par le créateur de votre site ; les autres styles appliquent leurs propres couleurs et polices.",
          "Si besoin, **personnalisez** : couleur principale (boutons, jour choisi), couleur d'accent (badges, détails), fond des cartes, fond du module, texte, bordures, polices, arrondis, taille du texte.",
          "Regardez l'**aperçu** à droite (en dessous sur téléphone), puis **Enregistrer**. Le site est mis à jour aussitôt.",
        ],
      },
      "« Réinitialiser » efface vos personnalisations et revient au style choisi. La petite flèche ↺ à côté d'une couleur annule seulement cette couleur.",
      { tip: "Gardez un bon contraste : un texte foncé sur fond clair (ou l'inverse) reste lisible pour tout le monde. La couleur du texte sur les boutons est choisie automatiquement." },
    ],
  },
  {
    id: "settings",
    title: "Réglages",
    summary: "Activité, zone, confirmation, rappels, formulaire, e-mails, langues.",
    blocks: [
      "Après une modification, une barre **Enregistrer les réglages** apparaît en bas de l'écran.",
      "**Activité.** Nom, téléphone et e-mail de contact (affichés aux clients et dans les e-mails). **Adresse du cabinet / point de départ** : cliquez sur **Localiser** pour enregistrer sa position (nécessaire pour la zone par distance).",
      "**Zone de déplacement** (soins à domicile) :",
      {
        list: [
          "**Aucune** : toutes les adresses sont acceptées.",
          "**Distance maximale** : en kilomètres à vol d'oiseau depuis votre point de départ.",
          "**Codes postaux** : une liste, séparée par des virgules ; « 77 » accepte tout le département.",
          "**Hors zone** : refuser la réservation, ou l'accepter comme **demande à confirmer**. Le message que vous écrivez est affiché au client (ex. « frais de déplacement au-delà de 20 km »).",
        ],
      },
      "**Confirmation et annulation.** Réservations **confirmées automatiquement** ou **demandes à valider** par vous. Autoriser ou non le client à annuler / déplacer en ligne, et jusqu'à combien d'heures avant. Le texte saisi (conditions d'annulation, règlement…) est affiché juste avant la confirmation.",
      "**Rappels.** Un e-mail de rappel est envoyé au client avant le rendez-vous (24 h par défaut).",
      "**Notifications.** Les adresses qui reçoivent un e-mail à chaque nouvelle réservation, annulation ou déplacement par un client.",
      "**Questions du formulaire.** Nom, e-mail et téléphone sont toujours demandés. Ajoutez vos questions :",
      {
        list: [
          "**Type** : texte court ou long, liste de choix, case à cocher, nombre, date, e-mail, téléphone.",
          "**Obligatoire** ou non.",
          "**Uniquement pour** certaines prestations ou catégories (ex. « semaine de grossesse » seulement pour la Maternité). Maintenez Ctrl (ou ⌘) pour en choisir plusieurs.",
          "**Case à cocher obligatoire** = consentement. `[conditions générales](#terms)` dans le texte ouvre vos conditions générales (voir [Conditions générales](#/help/terms)) ; `[texte](/page/)` ouvre une page du site.",
          "**Liste de choix** : une option par ligne, sous la forme `valeur | libellé`.",
        ],
      },
      "**Textes des e-mails.** Pour chaque e-mail envoyé aux clients, vous pouvez remplacer l'objet et le texte. Laissez vide pour garder le texte par défaut (affiché en gris). Variables disponibles : `{name}` (nom du client), `{service}`, `{date}`, `{time}`, `{duration}`, `{price}`, `{address}`, `{business}`. Le récapitulatif, le bouton et les liens d'agenda sont ajoutés automatiquement.",
      "**Conditions générales.** Le texte que vos clients acceptent : voir [Conditions générales](#/help/terms).",
      "**Langues et région.** Fuseau horaire (ex. Europe/Paris), devise, langues du site. À ne modifier qu'avec la personne qui a créé votre site.",
    ],
  },
  {
    id: "terms",
    title: "Conditions générales",
    summary: "Le texte que vos clients acceptent en réservant, et comment le modifier.",
    blocks: [
      "Dans le formulaire de réservation, la case « J'accepte les **conditions générales** » contient un lien : en cliquant dessus, le client lit vos conditions dans une fenêtre, sans quitter la réservation.",
      "**Le texte par défaut.** Un modèle complet est fourni (réservation, tarifs et paiement sur place, annulation, retard, déroulement, soins à domicile, rétractation, données personnelles, médiation). Il est rempli automatiquement avec le nom de votre activité, votre adresse, vos coordonnées et votre délai d'annulation (Réglages) : si vous les changez, le texte suit.",
      "**Le modifier :** Réglages → **Conditions générales** :",
      {
        steps: [
          "Cliquez sur **Mon texte** (ou « Modifier ce texte ») : le modèle est copié dans la zone de texte.",
          "Modifiez ce que vous voulez. Une ligne vide sépare les paragraphes ; « ## » en début de ligne fait un titre, « - » une liste, **gras** entre doubles astérisques.",
          "Vérifiez l'**aperçu**, puis **Enregistrer les réglages**.",
        ],
      },
      "Vous pouvez garder les variables `{business}`, `{address}`, `{email}`, `{phone}`, `{changeUntilHours}` et `{updated}` : elles sont remplacées par vos informations. **Revenir au texte par défaut** efface votre version.",
      { tip: "À compléter dans tous les cas : le nom et les coordonnées de votre **médiateur de la consommation** (obligatoire en France pour les clients particuliers). Le modèle est indicatif et ne remplace pas un conseil juridique." },
      "Chaque rendez-vous garde la version des conditions acceptée (date de dernière modification), affichée en bas du texte.",
      "Si la case à cocher a été supprimée du formulaire, un bouton dans Réglages → Conditions générales permet de la remettre. Pour l'ajouter vous-même : une question de type case à cocher, obligatoire, avec `[conditions générales](#terms)` dans son libellé.",
    ],
  },
  {
    id: "sync",
    title: "Synchroniser avec mon agenda",
    summary: "Voir vos rendez-vous dans Google Agenda, l'iPhone ou Outlook.",
    blocks: [
      "Dans **Réglages → Synchroniser avec mon agenda**, créez votre lien d'agenda personnel, puis cliquez sur le bouton de votre application :",
      {
        list: [
          "**Google Agenda** : ouvre Google Agenda et ajoute le calendrier.",
          "**iPhone / Mac** : ouvre l'app Calendrier qui propose de s'abonner.",
          "**Outlook** : ajoute le calendrier à Outlook.com.",
          "Autre application : copiez le lien et utilisez « S'abonner à un calendrier » / « Ajouter par URL ».",
        ],
      },
      "Vos rendez-vous (confirmés, à confirmer, terminés) apparaissent avec le nom du client, son téléphone et l'adresse. C'est une copie en lecture seule : les modifications se font toujours ici.",
      { tip: "Google Agenda met à jour les calendriers abonnés lentement (parfois plusieurs heures). L'iPhone et Outlook sont plus rapides. Pour une info à la minute, regardez l'Agenda de cet espace." },
      "Ce lien donne accès aux informations de vos clients : ne le partagez pas. En cas de doute, cliquez sur **Régénérer le lien** : l'ancien cesse de fonctionner (pensez à vous réabonner avec le nouveau).",
    ],
  },
  {
    id: "emails",
    title: "Ce que reçoivent vos clients",
    summary: "Les e-mails automatiques et les liens d'agenda.",
    blocks: [
      {
        list: [
          "**Confirmation** : dès la réservation (ou dès que vous confirmez une demande), avec le récapitulatif, l'**invitation d'agenda** en pièce jointe, les liens « Ajouter à mon agenda » (Google, Outlook, Apple) et le bouton **Gérer mon rendez-vous**.",
          "**Demande reçue** : si les réservations sont des demandes à valider, ou si l'adresse est hors zone.",
          "**Demande refusée** : quand vous refusez une demande.",
          "**Déplacement** et **Annulation** : quand vous ou le client changez le rendez-vous.",
          "**Rappel** : avant le rendez-vous (sauf s'il a été réservé au dernier moment).",
        ],
      },
      "Le bouton **Gérer mon rendez-vous** permet au client d'annuler ou de changer de date tout seul, jusqu'au délai fixé dans Réglages. Après ce délai, la page l'invite à vous contacter.",
      "Sur la page de confirmation du site, le client peut aussi ajouter le rendez-vous à son agenda (Google, Outlook, Apple).",
    ],
  },
  {
    id: "faq",
    title: "Questions fréquentes",
    summary: "Les situations courantes et comment les régler.",
    blocks: [
      "**Un client dit ne pas avoir reçu l'e-mail.** Demandez-lui de regarder dans ses spams / courriers indésirables, et vérifiez l'adresse dans la fiche du rendez-vous. Vous pouvez lui envoyer les informations par SMS ou WhatsApp depuis la fiche.",
      "**Je pars en vacances.** Disponibilités → Créneaux bloqués : bloquez la période entière. Les rendez-vous déjà pris ne sont pas annulés : vérifiez l'Agenda.",
      "**Deux clients peuvent-ils réserver le même créneau ?** Non. Même s'ils valident au même moment, un seul l'obtient ; l'autre est invité à choisir un autre horaire.",
      "**Un client veut annuler la veille mais le site refuse.** Le délai d'annulation en ligne est dépassé (Réglages → Confirmation et annulation). Annulez-le vous-même depuis sa fiche.",
      "**J'ai changé un prix, les anciens rendez-vous n'ont pas changé.** C'est voulu : chaque rendez-vous garde le prix au moment de la réservation.",
      "**Une adresse proche est déclarée hors zone.** La distance est calculée à vol d'oiseau depuis votre point de départ. Vérifiez qu'il est bien localisé (Réglages → Activité → Localiser) et ajustez le rayon.",
      "**Je ne vois plus un rendez-vous.** Les rendez-vous annulés ou refusés n'apparaissent plus dans l'Agenda ni le Calendrier ; on les retrouve dans l'historique du client (Clients).",
      "**Je ne peux pas me connecter.** Utilisez exactement l'adresse e-mail autorisée. Le lien de connexion par e-mail doit être ouvert sur le même appareil et le même navigateur. Sinon, contactez la personne qui gère votre site.",
    ],
  },
];

const en: HelpSection[] = [
  {
    id: "start",
    title: "Getting started",
    summary: "Signing in, finding your way, installing the admin on your phone.",
    blocks: [
      "This is where you manage your appointments: the ones clients book online and the ones you add yourself (phone, WhatsApp, in person). Everything you change here applies to your website immediately.",
      "**Signing in.** Use “Continue with Google” if your address is a Google account, or ask for a sign-in link by e-mail and open it on the same device. Only the addresses authorized at setup can get in.",
      { tip: "On a phone, add the admin to your home screen to open it like an app: in Safari, Share → “Add to Home Screen”; in Chrome, menu ⋮ → “Add to Home screen”." },
      "**Sections:**",
      {
        list: [
          "**Agenda**: requests to review, today's appointments and the next two weeks.",
          "**Calendar**: day, week or month view. Click an empty time to add an appointment.",
          "**Clients**: your client list, their history and your notes.",
          "**Services**: what clients can book, with durations and prices.",
          "**Availability**: your hours, days off and booking rules.",
          "**Appearance**: colors and fonts of the booking pages.",
          "**Settings**: business details, travel area, confirmations, e-mails, form questions.",
          "**Help**: this guide.",
        ],
      },
      "On a phone, the first four sections are at the bottom of the screen; the others are under “More”.",
    ],
  },
  {
    id: "agenda",
    title: "Your daily agenda",
    summary: "Requests to approve, today's and upcoming appointments.",
    blocks: [
      "The Agenda is the home page. It shows, in order:",
      {
        list: [
          "**Requests to review** (if any): bookings waiting for your approval. Click **Approve** or **Decline**; the client gets an e-mail automatically.",
          "**Today**: today's appointments with time, name, service and town for home visits.",
          "**Upcoming**: the next two weeks, day by day.",
        ],
      },
      "Click an appointment to open it (see [Managing an appointment](#/help/booking)).",
      { tip: "New bookings are also e-mailed to you (addresses in Settings → Notifications), and can appear in your phone's calendar: see [Sync with my calendar](#/help/sync)." },
    ],
  },
  {
    id: "booking",
    title: "Managing an appointment",
    summary: "Contacting the client, approving, moving, cancelling, taking notes.",
    blocks: [
      "An appointment opens in a side panel showing:",
      {
        list: [
          "The **status**, service, date, duration, price, address (home visits) and distance from your starting point.",
          "Contact details and **answers to the form** (e.g. pregnancy week).",
          "Quick buttons: **Call**, **SMS**, **WhatsApp**, **Directions** (Google Maps to the client's address).",
        ],
      },
      "**Statuses:**",
      {
        list: [
          "**To approve**: a request waiting for your answer. The time is already held so nobody else takes it.",
          "**Confirmed**: the appointment is on.",
          "**Completed**: it took place. Set automatically a few hours after the end; you can also set it yourself.",
          "**No-show**: the client didn't come. Useful to keep track.",
          "**Cancelled** / **Declined**: the time is free again.",
        ],
      },
      "**Move**: pick a new day, then a suggested free time, or type another time. If it overlaps another appointment you'll be warned and can “Save anyway”.",
      "**Cancel**: asks for confirmation, then frees the time.",
      "**Notify the client by e-mail**: on by default. Turn it off if you already told the client another way. Clients without an e-mail (phone bookings) must be told by you.",
      "**Private notes**: only visible to you, never to the client — door code, allergies, etc.",
      "**History**: who did what and when.",
    ],
  },
  {
    id: "new-booking",
    title: "Adding an appointment",
    summary: "For bookings made by phone, message or in person.",
    blocks: [
      "Two ways to start: **+ New appointment** in the Agenda, or **click an empty time** in the Calendar (date and time are prefilled).",
      {
        steps: [
          "Choose the **service**.",
          "Choose the **day**, then a suggested **free time**, or type any time. Times outside your usual hours are allowed.",
          "**Client**: type part of a name, e-mail or phone number to find an existing client; otherwise fill in “New client” (a name is enough).",
          "For a home visit, enter the **address** (an existing client's last address is reused).",
          "Choose the **status** (Confirmed or To approve) and add a note if needed.",
          "If the client has an e-mail, tick “Notify the client” so they get the confirmation and calendar invite.",
          "Click **Create appointment**.",
        ],
      },
      { tip: "An appointment added here blocks the time on the website immediately." },
    ],
  },
  {
    id: "calendar",
    title: "The calendar",
    summary: "Day, week, month views and colors.",
    blocks: [
      "Switch views with **Day / Week / Month**, move with the arrows, come back with “Today”. On phones, the Day view opens by default.",
      {
        list: [
          "**White**: your opening hours. **Grey**: closed.",
          "**Hatched**: time you blocked (see [Availability](#/help/availability)).",
          "**Colored appointment**: confirmed. **Yellow**: to approve. **Faded**: completed.",
          "**Red line**: now.",
        ],
      },
      "Click an appointment to open it, or an empty space to add one. In Month view, click a day to open it.",
    ],
  },
  {
    id: "clients",
    title: "Clients",
    summary: "Finding a client, their history, your notes, exporting the list.",
    blocks: [
      "The list fills itself with each booking (one client per e-mail address, or per phone number for appointments added without e-mail).",
      {
        list: [
          "**Search** by name, e-mail or phone.",
          "Click a client to see their details, last address, **all their appointments** and your **notes**.",
          "**New appointment** from their page: the client is preselected.",
          "**Export (CSV)**: downloads the list (opens in Excel, Numbers or Google Sheets).",
        ],
      },
      { tip: "Client data is personal: don't share the export and delete it when done (GDPR)." },
    ],
  },
  {
    id: "services",
    title: "Services",
    summary: "Creating, editing, ordering and hiding what can be booked.",
    blocks: [
      "Services appear on the website in this page's order, grouped by category. Use ↑ ↓ to reorder.",
      "**Service fields:**",
      {
        list: [
          "**Name** and **Description**: in each language of the site.",
          "**Category**: to group services (e.g. Body, Face). Create categories at the bottom of the page.",
          "**Location**: at the studio (its address is shown to the client), **at the client's home** (the client enters an address, checked against your travel area) or online.",
          "**Duration**: how long it takes — this is the time held in your calendar.",
          "**Price** and **Former price**: the former price is shown struck through. Leave the price empty for “On request”, 0 for “Free”.",
          "**Buffer before / after**: free time kept around the service (setup, tidying). E.g. 15 min after a facial.",
          "**Badge**: a small label such as “New” or “Discovery offer”.",
          "**Bookable online**: untick to **hide** a service without deleting it (you can still use it when adding appointments yourself).",
        ],
      },
      { tip: "Changing a price or duration doesn't change existing appointments: they keep the terms from when they were booked." },
      "**Deleting** a service is permanent; hide it instead if you may offer it again.",
    ],
  },
  {
    id: "availability",
    title: "Availability",
    summary: "Hours, days off, blocked time and booking rules.",
    blocks: [
      "**Weekly hours.** Tick working days and set one or more ranges per day (e.g. 9:00–12:30 and 14:00–19:00). Click **Save** at the top of the section.",
      "**Special days.** For a public holiday, a day off or special hours: pick the date, then “Closed all day” or “Special hours”. For a longer break, use blocked time instead.",
      "**Blocked time.** Makes a period unavailable: an errand, a personal appointment, a week of holidays (Monday 00:00 to Sunday 23:59). These times are no longer offered online.",
      "**Booking rules:**",
      {
        list: [
          "**Time slot interval**: the times offered (every 30 min: 9:00, 9:30, 10:00…).",
          "**Minimum notice**: e.g. 12 h = nobody can book less than 12 hours ahead.",
          "**Bookable up to**: how many days ahead (e.g. 60).",
          "**Maximum per day**: beyond it the day is full (0 = no limit).",
          "**Travel time**: added before and after each home visit so you have time to get there.",
        ],
      },
      { tip: "To pause online bookings, block the period, or hide the services in Services." },
    ],
  },
  {
    id: "appearance",
    title: "Appearance",
    summary: "Choosing a style, colors and fonts for the booking pages.",
    blocks: [
      "This page changes how the booking page and the “manage my appointment” page look on your website, and the button color in e-mails.",
      {
        steps: [
          "Choose a **style**: “Website design” keeps the colors set by your site's designer; the other styles apply their own colors and fonts.",
          "Optionally **customize**: main color (buttons, chosen day), accent color (badges, details), card background, module background, text, borders, fonts, corners, text size.",
          "Check the **preview** on the right (below on phones), then **Save**. The website updates immediately.",
        ],
      },
      "“Reset” removes your customizations and goes back to the chosen style. The ↺ next to a color resets just that color.",
      { tip: "Keep good contrast: dark text on a light background (or the reverse) stays readable for everyone. The text color on buttons is chosen automatically." },
    ],
  },
  {
    id: "settings",
    title: "Settings",
    summary: "Business, travel area, confirmation, reminders, form, e-mails, languages.",
    blocks: [
      "After a change, a **Save settings** bar appears at the bottom of the screen.",
      "**Business.** Name, phone and contact e-mail (shown to clients and in e-mails). **Studio address / starting point**: click **Locate** to save its position (needed for a distance-based area).",
      "**Travel area** (home visits):",
      {
        list: [
          "**None**: every address is accepted.",
          "**Maximum distance**: in km as the crow flies from your starting point.",
          "**Postcodes**: a comma-separated list; a prefix such as “77” accepts a whole area.",
          "**Out of area**: refuse the booking, or accept it as a **request to approve**. Your message is shown to the client (e.g. “travel fee beyond 20 km”).",
        ],
      },
      "**Confirmation & cancellation.** Bookings **confirmed automatically** or **requests you approve**. Whether clients can cancel / reschedule online, and until how many hours before. The text you enter (cancellation terms, payment…) is shown just before confirming.",
      "**Reminders.** A reminder e-mail is sent to the client before the appointment (24 h by default).",
      "**Notifications.** Addresses that get an e-mail for each new booking, and each client cancellation or change.",
      "**Form questions.** Name, e-mail and phone are always asked. Add your own:",
      {
        list: [
          "**Type**: short or long text, choice list, checkbox, number, date, e-mail, phone.",
          "**Required** or not.",
          "**Only for** some services or categories. Hold Ctrl (or ⌘) to select several.",
          "**Required checkbox** = consent. `[terms and conditions](#terms)` in its text opens your terms (see [Terms and conditions](#/help/terms)); `[text](/page/)` opens a page of the site.",
          "**Choice list**: one option per line, as `value | label`.",
        ],
      },
      "**E-mail texts.** Replace the subject and text of any client e-mail. Leave empty to keep the default (shown in grey). Variables: `{name}`, `{service}`, `{date}`, `{time}`, `{duration}`, `{price}`, `{address}`, `{business}`. The summary, button and calendar links are added automatically.",
      "**Terms and conditions.** The text your clients accept: see [Terms and conditions](#/help/terms).",
      "**Languages & region.** Time zone (e.g. Europe/Paris), currency, site languages. Change only with your site's developer.",
    ],
  },
  {
    id: "terms",
    title: "Terms and conditions",
    summary: "The text clients accept when booking, and how to change it.",
    blocks: [
      "In the booking form, the “I accept the **terms and conditions**” checkbox has a link: clicking it shows your terms in a window, without leaving the booking.",
      "**The default text.** A complete model is provided (booking, prices and payment on site, cancellation, lateness, the service itself, home visits, withdrawal, personal data, mediation). It is filled automatically with your business name, address, contact details and cancellation deadline (Settings): change those and the text follows.",
      "**To change it:** Settings → **Terms and conditions**:",
      {
        steps: [
          "Click **My text** (or “Edit this text”): the model is copied into the text box.",
          "Edit what you like. A blank line separates paragraphs; “## ” at the start of a line makes a heading, “- ” a list, **bold** between double asterisks.",
          "Check the **preview**, then **Save settings**.",
        ],
      },
      "You can keep the variables `{business}`, `{address}`, `{email}`, `{phone}`, `{changeUntilHours}` and `{updated}`: they are replaced by your details. **Back to the default text** removes your version.",
      { tip: "Always complete the name and contact details of your **consumer mediator** (mandatory in France for consumer clients). The model is only a model and is not legal advice." },
      "Each appointment keeps the version of the terms that was accepted (date of last change), shown at the bottom of the text.",
      "If the checkbox was removed from the form, a button in Settings → Terms and conditions puts it back. To add it yourself: a required checkbox question with `[terms and conditions](#terms)` in its label.",
    ],
  },
  {
    id: "sync",
    title: "Sync with my calendar",
    summary: "See your appointments in Google Calendar, iPhone or Outlook.",
    blocks: [
      "In **Settings → Sync with my calendar**, create your personal calendar link, then click the button for your app:",
      {
        list: [
          "**Google Calendar**: opens Google Calendar and adds it.",
          "**iPhone / Mac**: opens the Calendar app, which offers to subscribe.",
          "**Outlook**: adds it to Outlook.com.",
          "Other apps: copy the link and use “Subscribe to calendar” / “Add from URL”.",
        ],
      },
      "Appointments (confirmed, to approve, completed) appear with the client's name, phone and address. It's a read-only copy: changes are always made here.",
      { tip: "Google Calendar refreshes subscribed calendars slowly (sometimes several hours). iPhone and Outlook are faster. For up-to-the-minute information, use this Agenda." },
      "This link gives access to client information: don't share it. If in doubt, click **Regenerate link**: the old one stops working (subscribe again with the new one).",
    ],
  },
  {
    id: "emails",
    title: "What your clients receive",
    summary: "Automatic e-mails and calendar links.",
    blocks: [
      {
        list: [
          "**Confirmation**: on booking (or when you approve a request), with the summary, a **calendar invite** attached, “Add to my calendar” links (Google, Outlook, Apple) and a **Manage my appointment** button.",
          "**Request received**: when bookings are requests, or the address is out of area.",
          "**Request declined**: when you decline.",
          "**Moved** and **Cancelled**: when you or the client change it.",
          "**Reminder**: before the appointment (unless it was booked at the last minute).",
        ],
      },
      "**Manage my appointment** lets the client cancel or reschedule on their own, until the deadline set in Settings. After that, the page asks them to contact you.",
      "On the website's confirmation screen, the client can also add the appointment to their calendar (Google, Outlook, Apple).",
    ],
  },
  {
    id: "faq",
    title: "FAQ",
    summary: "Common situations and how to handle them.",
    blocks: [
      "**A client says they didn't get the e-mail.** Ask them to check their spam folder, and check the address on the appointment. You can send the details by SMS or WhatsApp from the appointment.",
      "**I'm going on holiday.** Availability → Blocked time: block the whole period. Existing appointments are not cancelled: check the Agenda.",
      "**Can two clients book the same time?** No. Even if they confirm at the same moment, only one gets it; the other is asked to pick another time.",
      "**A client wants to cancel the day before but the site refuses.** The online cancellation deadline has passed (Settings → Confirmation & cancellation). Cancel it yourself from the appointment.",
      "**I changed a price and old appointments didn't change.** That's intended: each appointment keeps the price from when it was booked.",
      "**A nearby address is out of area.** Distance is measured as the crow flies from your starting point. Check it is located (Settings → Business → Locate) and adjust the radius.",
      "**An appointment disappeared.** Cancelled or declined appointments are hidden from the Agenda and Calendar; find them in the client's history (Clients).",
      "**I can't sign in.** Use exactly the authorized e-mail. An e-mail sign-in link must be opened on the same device and browser. Otherwise contact whoever manages your website.",
    ],
  },
];

export const HELP: Record<string, HelpSection[]> = { fr, en };
