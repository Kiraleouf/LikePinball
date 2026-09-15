# LikePinball

LikePinball est un roguelike de flipper futuriste, minimaliste et évolutif.

## Développement actuel — Component Studio (3D)

Le moteur actuel utilise Three.js et Rapier. Le cadrage V0 ci-dessous décrit l’intention initiale ; les évolutions V1/V2 sont suivies dans les Issues.

```sh
npm ci
npm run dev
```

- Jeu : `/`
- Showroom : `/?showroom=1`
- Éditeur de secteurs : `/?editor=1`

Le **Component Studio** permet d’explorer huit composants avec une caméra orbitale, leurs états et des paramètres de forme/matière. Les premières propositions visuelles sont **provisoires** : le showroom sert à les faire évoluer.

### Une bibliothèque commune

`src/three/components/` contient l’unique factory des pièces, leurs paramètres, les états visuels, les dimensions de collision et l’éclairage du jeu. Le jeu et l’éditeur consomment cette bibliothèque directement. Les transformations du plateau et la simulation Rapier restent dans le jeu ; les composants n’importent pas le gameplay.

- `Idle` : repos ; `Hit` : impact bref ; `Activate` : action, lorsqu’elle est pertinente.
- Lanceur : régler la charge puis utiliser `Hit / relâcher` pour tester le piston.
- Flippers : la physique pilote la pose en jeu ; le showroom prévisualise les angles des flippers principaux.
- Les sliders de dimensions sont des multiplicateurs. Les corps ronds conservent un diamètre unique et les colliders utilisent les mêmes dimensions que le rendu. Les chanfreins, inserts et petits détails restent décoratifs ; les colliders conservent les formes simplifiées de V2.
- Les posts et le piston étaient décoratifs dans le moteur V2 et le restent. Modifier une dimension fonctionnelle peut affecter la jouabilité ou les dégagements d’un secteur : vérifier une run avant de retenir le preset.

### Conserver et partager un preset

1. Les modifications sont d’abord des aperçus dans le showroom.
2. **Appliquer au jeu & à l’éditeur** sauvegarde le catalogue dans le navigateur. Ouvrir/recharger ces vues sur la même origine pour retrouver le preset.
3. **Exporter JSON** conserve une version partageable ; **Importer un preset** la charge en aperçu, avec validation du format et des plages de valeurs.
4. Pour une version distribuée à tous, intégrer le JSON validé dans `src/three/components/presets.json` et le committer. Il devient le défaut partagé. Un preset local appliqué reste prioritaire.

Les formats des templates de secteurs existants restent inchangés. La palette du catalogue commun définit désormais l’apparence des pièces dans les trois vues.

Vérifications : `npm run typecheck`, `npm test`, `npm run build`, puis showroom, éditeur et jeu dans le navigateur.

L'idée centrale est simple : **jouer au flipper, atteindre l'objectif de score du plateau, ouvrir un portail vers le plateau suivant et aller le plus loin possible avant de perdre toutes ses billes.**

Le jeu doit privilégier le feeling du flipper avant toute autre mécanique.

## Direction artistique

- univers futuriste abstrait ;
- fond noir / très sombre ;
- éléments fonctionnels en néon ;
- design sobre et lisible ;
- pas d'assets graphiques nécessaires pour la V0 : géométrie, lumières et effets sont générés par le moteur ;
- l'évolution visuelle future doit autant que possible correspondre à une évolution mécanique du plateau.

## Boucle de jeu cible

Une run commence toujours au **plateau 0**.

Chaque plateau possède un objectif de score. Exemple initial :

```text
Plateau 0 : 0 → 10 000 points
       ↓
objectif atteint
       ↓
activation d'un portail
       ↓
le joueur doit envoyer physiquement la bille dans le portail
       ↓
Plateau suivant
```

Atteindre le score ne termine donc pas immédiatement le plateau : cela **débloque la sortie**, qu'il faut encore réussir à atteindre avec la bille.

La run se termine lorsque le joueur n'a plus de billes.

À terme, la progression atteinte pendant une run donnera une monnaie permanente permettant d'acheter des améliorations entre les runs.

## Progression future

Les améliorations permanentes pourront notamment concerner :

- multiplicateur de score ;
- multiplicateur de monnaie de fin de run ;
- nombre de billes au début d'une run ;
- bumpers ;
- flippers ;
- rails ;
- bonus ;
- balle ;
- portails ;
- autres systèmes ajoutés ultérieurement.

Cette méta-progression n'appartient **pas à la V0**.

## V0 — Playable Prototype

La V0 doit uniquement répondre à cette question :

> **Est-ce que le flipper est agréable à jouer et est-ce que la boucle score → portail → plateau suivant fonctionne ?**

La V0 comprend :

- application web TypeScript ;
- moteur 2D adapté au flipper ;
- un plateau 0 jouable ;
- une bille avec une physique stable ;
- deux flippers contrôlables ;
- murs et collisions ;
- lanceur / relance de bille ;
- bumpers donnant des points ;
- score affiché ;
- nombre de billes restantes ;
- objectif du plateau 0 fixé à 10 000 points ;
- apparition/activation d'un portail à 10 000 points ;
- passage au plateau suivant uniquement lorsque la bille entre dans le portail ;
- un plateau suivant minimal permettant de valider la transition ;
- direction visuelle black + néon ;
- fonctionnement desktop au clavier.

## Hors périmètre V0

Ne pas implémenter dans cette version :

- monnaie permanente ;
- boutique ;
- arbres d'améliorations ;
- roguelike upgrades pendant une run ;
- génération procédurale complexe ;
- comptes utilisateurs ;
- leaderboard ;
- multijoueur ;
- audio élaboré ;
- mobile/touch ;
- nombreux plateaux ;
- assets graphiques externes.

## Principes techniques

La stack exacte peut être décidée pendant l'implémentation, mais **Phaser + TypeScript avec Matter.js** est une option naturelle si elle permet d'obtenir le meilleur compromis entre simplicité et qualité de physique.

Le code doit séparer autant que raisonnablement possible :

- définition d'un plateau ;
- physique ;
- rendu ;
- scoring/progression.

L'objectif est de pouvoir créer de futurs plateaux principalement à partir de données/configuration plutôt qu'en recopiant toute la logique du jeu.

## Priorité absolue : le feeling

Une physique techniquement correcte mais désagréable n'est pas acceptable.

Les flippers doivent permettre de viser de manière raisonnablement reproductible. La V0 doit donc prévoir une phase explicite de calibration : gravité, restitution, friction, masse, vitesse des flippers, force transmise à la bille et gestion des collisions à haute vitesse.

Ne pas complexifier le roguelike tant que cette base n'est pas satisfaisante.

## Gestion du travail

Les tâches d'implémentation sont suivies via les GitHub Issues et le GitHub Project associé au repository.

Chaque issue doit rester limitée à son périmètre. Une issue n'est terminée que lorsque ses critères d'acceptation sont satisfaits et que les vérifications pertinentes passent.
