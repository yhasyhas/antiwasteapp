# Bibliothèque de plats de référence

851 plats dans 15 régions. Fichier généré par `node scripts/library-doc.mjs` à partir de `supabase/functions/generate-recipes/library/` : on corrige les fichiers JSON, puis on relance le script.

**À quoi elle sert** : quand une cuisine précise est choisie, le prompt reçoit 5 plats tirés au hasard dans ses régions (du moment de la journée demandé), comme source d'inspiration. Le modèle s'inspire de l'esprit de la cuisine et crée des recettes adaptées au garde-manger, sans recopier ces plats ni s'y limiter. Avec « Peu importe », aucun plat n'est envoyé.

**Pour les relecteurs** : pour chaque plat, vérifier le nom, les pays, les ingrédients essentiels (sans eux ce n'est plus ce plat), les techniques, les moments où on le mange vraiment, et le régime de la version courante. Signaler aussi les plats importants qui manquent.

## Sommaire

| Région | Cuisine de l'app | Plats | Matin | Encas |
|---|---|---|---|---|
| [Afrique de l'Ouest](#afrique-ouest) | Africaine | 60 | 18 | 15 |
| [Afrique centrale](#afrique-centrale) | Africaine | 50 | 13 | 8 |
| [Afrique de l'Est](#afrique-est) | Africaine | 60 | 21 | 11 |
| [Afrique australe](#afrique-australe) | Africaine | 53 | 13 | 12 |
| [Océan Indien](#ocean-indien) | Africaine | 44 | 11 | 17 |
| [Maghreb](#maghreb) | Maghreb | 49 | 14 | 14 |
| [Asie de l'Est](#asie-est) | Asiatique | 59 | 25 | 14 |
| [Asie du Sud-Est](#asie-sud-est) | Asiatique | 60 | 27 | 18 |
| [Asie du Sud](#asie-sud) | Asiatique | 60 | 23 | 13 |
| [Mexique et Amérique centrale](#mexique-amerique-centrale) | Amérique latine | 60 | 23 | 19 |
| [Caraïbes](#caraibes) | Amérique latine | 60 | 16 | 11 |
| [Amérique du Sud](#amerique-sud) | Amérique latine | 60 | 19 | 18 |
| [Europe du Sud](#europe-sud) | Méditerranéenne | 60 | 14 | 18 |
| [Proche-Orient et Turquie](#levant-turquie) | Méditerranéenne | 56 | 22 | 19 |
| [France](#france) | Française | 60 | 10 | 19 |

<a id="afrique-ouest"></a>

## Afrique de l'Ouest (60 plats)

| Plat | Pays | Ingrédients essentiels | Techniques | Moments | Régime |
|---|---|---|---|---|---|
| Thiéboudienne (ceebu jën) | Sénégal, Mauritanie, Gambie | riz brisé, poisson (thiof, mérou, capitaine), concentré de tomate, légumes (chou, carotte, manioc, aubergine, navet), oignon, persil, ail et piment (rof), poisson séché ou fermenté (guedj, yet) | farcir le poisson au rof, cuire les légumes dans la sauce tomate, cuire le riz dans le bouillon | midi |  |
| Yassa | Sénégal, Gambie, Guinée | poulet (ou poisson), oignons en grande quantité, citron, moutarde, ail, piment, riz blanc | mariner au citron et à l'oignon, griller ou dorer la viande, confire les oignons | midi, soir |  |
| Mafé (tigadèguèna) | Sénégal, Mali, Guinée | pâte d'arachide, viande (bœuf, agneau) ou poulet, tomate (concentré), oignon, légumes (patate douce, carotte, chou, manioc), riz blanc | revenir la viande, mijoter dans la sauce arachide | midi, soir |  |
| Thiou (ragoût en sauce tomate) | Sénégal | viande, poulet ou poisson, concentré de tomate, oignon, pomme de terre, carotte, ail, riz blanc | revenir l'oignon et la viande, mijoter en sauce tomate | midi, soir |  |
| Soupou kandja (sauce gombo) | Sénégal, Gambie, Guinée | gombo, huile de palme, poisson (frais et fumé), viande ou fruits de mer (crevettes, crabe), oignon, piment, riz blanc | couper finement le gombo, mijoter à l'huile de palme | midi |  |
| Thiéré (couscous de mil) en sauce | Sénégal, Mali, Mauritanie | couscous de mil (thiéré), viande (agneau, bœuf) ou poulet, légumes (chou, carotte, navet, niébé), oignon, poudre de feuilles de baobab (lalo) | rouler et cuire le mil à la vapeur, mijoter la sauce viande et légumes | soir |  |
| Ndambé (sandwich de haricots) | Sénégal | niébé ou haricots blancs, oignon, concentré de tomate, piment, pain | mijoter les haricots en sauce tomate, garnir le pain | matin, encas |  |
| Fondé (bouillie de mil au lait caillé) | Sénégal, Mali | farine de mil roulée en boulettes, lait caillé, sucre, vanille ou muscade | rouler la farine en boulettes, cuire en bouillie, servir avec le lait caillé | matin, soir | végétarien |
| Thiakry (dégué) | Sénégal, Mali, Burkina Faso, Niger | semoule de mil (ou couscous de blé), lait caillé ou yaourt, sucre, vanille, muscade, raisins secs (facultatif) | cuire la semoule à la vapeur, mélanger au lait caillé sucré | encas, matin | végétarien |
| Accara (akara, kosai) | Sénégal, Nigeria, Niger, Bénin, Togo, Ghana, Sierra Leone | niébé décortiqué, oignon, piment, sel, huile de friture | mixer les haricots trempés en pâte, fouetter pour aérer, frire en beignets | matin, encas | vegan |
| Fataya | Sénégal, Gambie | pâte (farine, eau, huile), poisson ou viande hachée, oignon, piment, sauce tomate-oignon pimentée | farcir en chaussons, frire | encas |  |
| Benachin | Gambie | riz, viande, poulet ou poisson, concentré de tomate, oignon, légumes (chou, carotte, aubergine), piment | mijoter la sauce tomate, cuire le riz dans la sauce (un seul pot) | midi |  |
| Riz au gras (riz gras, zamè) | Burkina Faso, Mali, Bénin, Togo, Côte d'Ivoire | riz, concentré de tomate, oignon, viande ou poulet, légumes (carotte, chou, aubergine), huile | faire une sauce tomate à la viande, cuire le riz dans la sauce | midi |  |
| Tô avec sauce gombo (ou sauce feuilles) | Burkina Faso, Mali, Niger, Togo, Bénin (nord) | farine de mil, sorgho ou maïs, gombo (frais ou séché) ou feuilles de baobab, soumbala, viande ou poisson séché, potasse ou eau acidulée (pour le tô) | cuire la farine en pâte ferme en remuant, préparer une sauce gluante | midi, soir |  |
| Babenda | Burkina Faso | feuilles vertes (oseille, haricot, chou), brisures de riz ou farine de mil, soumbala, arachides grillées ou pâte d'arachide, poisson séché | cuire les feuilles avec la céréale en bouillie épaisse | midi, soir |  |
| Gonré (gâteau de niébé à la vapeur) | Burkina Faso | farine de niébé, feuilles (de haricot ou d'oseille) en enveloppe ou hachées, piment, sel, huile | façonner la pâte en boudins, cuire à la vapeur | encas, midi | vegan |
| Maasa (beignets de mil ou de riz) | Mali, Burkina Faso, Niger, Nigeria (nord) | farine de mil ou riz cuit, levure ou ferment, sucre, huile | faire fermenter la pâte, cuire dans un moule à alvéoles ou frire | matin, encas | vegan |
| Moni (bouillie de mil en boulettes) | Mali, Burkina Faso | farine de mil roulée en petites boulettes, eau, sucre, jus de citron ou tamarin, lait caillé (facultatif) | rouler la farine en grains, cuire en bouillie acidulée | matin | vegan |
| Djouka (fonio aux arachides) | Mali, Guinée | fonio, pâte d'arachide, oignon, viande ou poisson (facultatif) | cuire le fonio à la vapeur, le mélanger à une sauce arachide | midi, soir |  |
| Sauce feuille (feuilles de manioc) | Guinée, Sierra Leone (cassava leaf), Liberia | feuilles de manioc pilées, huile de palme, pâte d'arachide (souvent), viande ou poisson fumé, oignon, piment, riz blanc | piler les feuilles, mijoter longuement à l'huile de palme | midi, soir |  |
| Potato leaf (sauce feuilles de patate douce) | Sierra Leone, Liberia | feuilles de patate douce hachées, huile de palme, poisson fumé ou viande, oignon, piment, riz blanc | hacher finement les feuilles, mijoter à l'huile de palme | midi, soir |  |
| Palm butter (sauce noix de palme) | Liberia | noix de palme (pulpe ou crème de palme), poulet, viande ou poisson fumé, oignon, piment, riz blanc | extraire la crème de palme, mijoter jusqu'à épaississement | midi, soir |  |
| Attiéké poisson | Côte d'Ivoire | attiéké (semoule de manioc fermentée), poisson frit ou braisé, tomate, oignon, piment, huile | réchauffer l'attiéké à la vapeur, frire ou braiser le poisson, faire une crudité tomate-oignon | midi, soir |  |
| Garba | Côte d'Ivoire | attiéké, thon frit, oignon, piment frais, huile de friture, cube de bouillon | frire le thon en morceaux, arroser l'attiéké d'huile de friture | midi, encas |  |
| Alloco | Côte d'Ivoire, Burkina Faso, Togo, Bénin | banane plantain mûre, huile de friture, sel, piment et oignon (sauce) | couper en rondelles ou dés, frire | encas, soir, matin | vegan |
| Sauce graine | Côte d'Ivoire, Ghana (palm nut soup) | noix de palme (graine) ou crème de palme, viande, poulet ou poisson fumé, aubergine ou gombo, oignon, piment, riz ou foutou | extraire le jus des noix de palme, mijoter longuement | midi, soir |  |
| Kédjénou | Côte d'Ivoire | poulet (ou pintade), tomate, oignon, aubergine, piment, gingembre et ail | cuire à l'étouffée sans eau dans un canari fermé, secouer la marmite | midi, soir |  |
| Foutou banane avec sauce claire | Côte d'Ivoire | banane plantain, igname ou manioc (selon la version), viande ou poisson, tomate, aubergine, piment | bouillir et piler le plantain en pâte, préparer une sauce légère bouillie | midi, soir |  |
| Jollof rice | Nigeria, Ghana, Sierra Leone, Liberia | riz, tomate et poivron rouge mixés, oignon, piment (scotch bonnet), concentré de tomate, bouillon, thym, curry, laurier | frire la base tomate-poivron, cuire le riz dans la sauce à l'étouffée | midi, soir |  |
| Egusi soup | Nigeria, Ghana, Sierra Leone | graines de courge moulues (egusi), légumes-feuilles (épinard, feuilles amères), huile de palme, viande, poisson fumé ou stockfish, crevettes séchées en poudre, piment | frire l'egusi dans l'huile de palme, mijoter avec la viande et les feuilles | midi, soir |  |
| Efo riro | Nigeria (Yoruba) | épinards ou amarante (efo), poivron rouge, tomate et piment mixés, huile de palme, iru (graines de néré fermentées), viande ou poisson fumé, crevettes séchées | frire la base de poivrons, ajouter les feuilles en fin de cuisson | midi, soir |  |
| Okra soup | Nigeria, Ghana | gombo haché ou râpé, huile de palme, viande ou poisson, crevettes séchées, piment, feuilles (ugu ou épinard) | râper le gombo, cuire brièvement pour garder le vert | midi, soir |  |
| Ewedu et gbegiri | Nigeria (Yoruba) | feuilles de corète (ewedu), haricots pelés en purée (gbegiri), huile de palme, iru, ragoût de tomate (obe ata), amala (pâte d'igname séchée) | fouetter les feuilles cuites, réduire les haricots en purée lisse | midi, soir |  |
| Moi moi (moin moin) | Nigeria, Ghana, Bénin | niébé décortiqué mixé, poivron rouge et piment, oignon, huile, œuf dur ou poisson (souvent), crevettes séchées (souvent) | mixer les haricots en pâte lisse, cuire à la vapeur en feuilles ou en moules | matin, midi |  |
| Ewa agoyin (haricots à la sauce pimentée) | Nigeria (Lagos) | haricots (niébé ou haricots honey), huile de palme, piment séché, oignon, pain (agege bread, souvent) | cuire les haricots jusqu'à purée, frire longuement la sauce pimentée à l'huile de palme | matin, midi | vegan |
| Yam porridge (asaro) | Nigeria | igname, huile de palme, tomate, poivron et piment mixés, oignon, poisson fumé ou crevettes séchées, légumes-feuilles (facultatif) | cuire l'igname dans la sauce, écraser en partie pour épaissir | midi, soir |  |
| Ogi (akamu, pap) avec akara | Nigeria, Bénin (koko), Togo | maïs, sorgho ou mil fermenté (ogi), eau bouillante, sucre, lait (facultatif), akara en accompagnement | faire fermenter et tamiser la pâte de céréale, délayer à l'eau bouillante | matin | vegan |
| Puff-puff (beignets) | Nigeria, Ghana (bofrot), Cameroun, Togo, Bénin | farine, levure, sucre, eau, muscade (facultatif), huile de friture | laisser lever la pâte, frire en boules à la main | encas, matin | vegan |
| Suya | Nigeria (nord), Niger (tchinchinga), Ghana (chichinga) | bœuf en fines tranches, yaji (épices à la poudre d'arachide), huile, oignon cru, tomate | enrober d'épices, griller en brochettes sur la braise | encas, soir |  |
| Dodo (plantain frit) | Nigeria, Ghana, Bénin, Togo | banane plantain mûre, huile de friture, sel | frire en tranches | matin, midi, encas | vegan |
| Tuwo shinkafa et miyan kuka | Nigeria (nord), Niger | riz très cuit (tuwo), poudre de feuilles de baobab (kuka), viande ou poisson séché, daddawa (néré fermenté), oignon, piment | cuire le riz en pâte et façonner en boules, délayer la poudre de baobab dans le bouillon | soir, midi |  |
| Fura (fura da nono) | Niger, Nigeria (nord), Burkina Faso, Ghana (nord) | boules de mil cuites et épicées (gingembre, piment), lait caillé ou lait fermenté, sucre | piler le mil cuit en boules, émietter dans le lait caillé | matin, encas | végétarien |
| Dambou | Niger, Nigeria (nord) | semoule de mil, maïs ou riz, feuilles de moringa, arachides pilées, oignon, huile | cuire la semoule à la vapeur, mélanger aux feuilles et aux arachides | midi, soir | vegan |
| Hausa koko et koose | Ghana | mil fermenté, gingembre, piment et clou de girofle, sucre, koose (akara) en accompagnement | faire fermenter la pâte de mil, cuire en bouillie épicée | matin | vegan |
| Waakye | Ghana | riz, haricots (niébé ou haricots rouges), feuilles de sorgho séchées (pour la couleur), shito (sauce pimentée au poisson séché), sauce tomate, œuf, gari ou spaghetti (accompagnements) | cuire les haricots avec les feuilles, cuire le riz dans l'eau des haricots | matin, midi |  |
| Red red | Ghana | niébé, huile de palme, tomate, oignon, piment, plantain frit (accompagnement) | cuire les haricots, mijoter dans une sauce à l'huile de palme | midi, soir | vegan |
| Kenkey avec poisson frit | Ghana | pâte de maïs fermentée, feuilles de maïs ou de bananier, poisson frit, sauce pimentée crue (tomate, oignon, piment) | fermenter la pâte de maïs, envelopper et cuire à l'eau | midi, soir |  |
| Banku avec okro stew ou tilapia | Ghana | pâte de maïs fermentée, pâte de manioc, tilapia grillé ou ragoût de gombo, piment, tomate et oignon écrasés | cuire la pâte en remuant vigoureusement, façonner en boules | midi, soir |  |
| Fufu et light soup | Ghana, Côte d'Ivoire, Togo | manioc et plantain bouillis et pilés, tomate, oignon, piment, chèvre, poulet ou poisson, gingembre | piler le fufu au mortier, mixer les légumes cuits dans le bouillon | midi, soir |  |
| Groundnut soup (nkate nkwan) | Ghana, Sierra Leone | pâte d'arachide, poulet ou chèvre, tomate, oignon, piment, gingembre | délayer la pâte d'arachide, mijoter jusqu'à ce que l'huile remonte | midi, soir |  |
| Kontomire stew (palava sauce) | Ghana | feuilles de taro (kontomire) ou épinards, huile de palme, egusi (souvent), tomate, oignon, poisson fumé ou œuf | hacher les feuilles, mijoter en ragoût à l'huile de palme | midi, soir |  |
| Kelewele | Ghana | banane plantain bien mûre, gingembre, piment, oignon, sel, huile de friture | mariner les dés de plantain aux épices, frire | encas, soir | vegan |
| Tuo zaafi (TZ) | Ghana (nord), Burkina Faso | farine de maïs ou de mil, feuilles de corète ou de baobab (soupe ayoyo), gombo, viande ou poisson séché, dawadawa | cuire la pâte en remuant, préparer une soupe verte gluante | midi, soir |  |
| Gboma dessi (sauce aux épinards) | Bénin, Togo | feuilles de gboma (morelle) ou épinards, tomate, oignon, huile de palme, poisson fumé ou viande, piment | blanchir et presser les feuilles, mijoter en sauce tomate | midi, soir |  |
| Amiwo (pâte rouge) | Bénin, Togo | farine de maïs, concentré de tomate, oignon, huile, poulet ou poisson frit, piment | préparer une sauce tomate, y cuire la farine en pâte | midi, soir |  |
| Ablo | Togo, Bénin | farine de maïs et farine de riz, levure, sucre, sel | faire fermenter la pâte, cuire à la vapeur dans de petits moules | midi, encas | vegan |
| Bouillie de maïs ou de mil (koko, gnomi koko) | Burkina Faso, Togo, Bénin, Côte d'Ivoire, Ghana | farine de maïs ou de mil, eau, sucre, jus de citron, gingembre ou tamarin, lait (facultatif) | délayer la farine, cuire en remuant jusqu'à épaississement | matin | vegan |
| Cachupa | Cap-Vert | maïs concassé (hominy), haricots (rouges, fèves, niébé), manioc, patate douce, courge, chou, viande (porc, chorizo) ou poisson (thon) selon la version, oignon, ail, laurier | mijoter longuement maïs et haricots, ajouter légumes et viande | midi, soir |  |
| Cachupa refogada | Cap-Vert | cachupa de la veille, oignon, huile ou saindoux, œuf au plat, saucisse (facultatif) | faire sauter les restes de cachupa à la poêle | matin |  |
| Cuscus de milho (couscous de maïs) | Cap-Vert | farine de maïs, eau, sel, beurre ou lait, miel de canne (facultatif) | humidifier la farine, cuire à la vapeur dans un binde (pot en terre) | matin, encas | végétarien |

<a id="afrique-centrale"></a>

## Afrique centrale (50 plats)

| Plat | Pays | Ingrédients essentiels | Techniques | Moments | Régime |
|---|---|---|---|---|---|
| Ndolé | Cameroun (Littoral) | feuilles de ndolé (vernonia) lavées, arachides crues pilées, crevettes séchées ou fraîches, viande de bœuf ou poisson fumé, oignon, ail et gingembre | laver et presser les feuilles pour l'amertume, mijoter dans la pâte d'arachide | midi, soir |  |
| Eru | Cameroun (Sud-Ouest) | feuilles d'eru (gnetum) émincées, feuilles de waterleaf ou épinards, huile de palme, viande, peau de bœuf (kanda) et poisson fumé, écrevisses séchées, piment | émincer très finement les feuilles, cuire les feuilles d'eru dans l'huile de palme | midi, soir |  |
| Okok sucré ou salé | Cameroun (Centre, Sud), Gabon (nkoumou) | feuilles de gnetum (okok) émincées, pâte d'arachide ou jus de noix de palme, sucre (version sucrée) ou poisson fumé (version salée), bâtons de manioc | piler ou émincer les feuilles, mijoter avec l'arachide | midi, soir |  |
| Koki | Cameroun | niébé décortiqué mixé, huile de palme rouge, piment, sel, feuilles de bananier (cuisson), feuilles de taro ou macabo (souvent) | mixer les haricots en pâte, envelopper en feuilles et cuire à la vapeur | midi, soir, matin | vegan |
| Beignets-haricots-bouillie (BHB) | Cameroun | farine, levure, sucre, haricots rouges en sauce, bouillie de maïs | frire des beignets levés, mijoter les haricots, cuire la bouillie de maïs | matin | vegan |
| Bouillie de maïs | Cameroun, Congo, RDC, Centrafrique | farine de maïs (ou maïs fermenté), eau, sucre, jus de citron ou lait (selon les maisons) | délayer la farine, cuire en remuant | matin | vegan |
| Puff-puff (beignets, mikate) | Cameroun, Congo, RDC, Gabon, Centrafrique | farine, levure, sucre, eau, huile de friture | laisser lever la pâte, frire en boules | matin, encas | vegan |
| Accra banane (beignets de plantain mûr) | Cameroun | bananes plantains très mûres ou bananes douces, farine de maïs ou de blé, sucre, huile de friture | écraser les bananes avec la farine, frire en petits beignets | encas, matin | vegan |
| Omelette spaghetti | Cameroun | spaghetti cuits, œufs, oignon, tomate, piment, pain (souvent) | mélanger pâtes et œufs battus, cuire en omelette à la poêle | matin, encas | végétarien |
| Corn chaff | Cameroun (Nord-Ouest, Ouest) | maïs sec, haricots, huile de palme, oignon, tomate, piment | cuire longuement maïs et haricots, mijoter avec huile de palme et tomate | matin, midi, soir | vegan |
| Achu et sauce jaune | Cameroun (Nord-Ouest) | taro pilé (achu), huile de palme, eau de cendres (potasse), épices (nkui, poivre de Penja), viande ou tripes, feuilles vertes (huckleberry) | piler le taro bouilli, émulsionner l'huile de palme avec la potasse | midi, soir |  |
| Taro sauce jaune | Cameroun (Ouest, Bamiléké) | taro pilé, huile de palme, sel gemme ou potasse, épices (njansang, poivre blanc), viande, peau de bœuf ou poisson fumé, feuilles de taro | piler le taro, émulsionner l'huile de palme dans la sauce | midi, soir |  |
| Mbongo tchobi | Cameroun (Bassa) | épices mbongo grillées (graines noircies), poisson (carpe, maquereau) ou viande, oignon, ail et gingembre, tomate, plantain ou bâtons de manioc | griller et piler les épices, mijoter le poisson dans la sauce noire | midi, soir |  |
| Mintumba | Cameroun (Centre, Sud) | pâte de manioc fermentée, huile de palme, sel, sucre ou piment, feuilles de bananier | mélanger la pâte à l'huile de palme, envelopper et cuire à la vapeur | encas, midi | vegan |
| Sanga | Cameroun (Centre) | maïs frais, feuilles de morelle noire (zom) ou épinards, jus de noix de palme, sucre (souvent) | mixer le maïs, cuire avec les feuilles et le jus de palme | midi, soir | vegan |
| Folong (sauce aux feuilles) | Cameroun (Centre, Sud) | feuilles de folong (amarante), pâte d'arachide ou jus de palme, poisson fumé ou crevettes, oignon, piment | hacher les feuilles, mijoter avec l'arachide | midi, soir |  |
| Kpwem (feuilles de manioc à l'arachide) | Cameroun (Est) | feuilles de manioc pilées, pâte d'arachide ou jus de noix de palme, poisson fumé ou viande, piment | piler les feuilles, cuire longuement avec l'arachide | midi, soir |  |
| Ekwang | Cameroun (Sud-Ouest) | macabo (malanga) râpé, feuilles de taro ou de macabo, huile de palme, poisson fumé et écrevisses, piment | rouler le macabo râpé dans les feuilles, cuire en couches dans la sauce à l'huile de palme | midi, soir |  |
| Kondrè | Cameroun (Ouest) | plantain vert, viande (chèvre, bœuf), tomate, oignon, épices (njansang, gingembre, ail), huile de palme | mijoter plantain et viande dans la sauce épicée | midi, soir |  |
| Poulet DG | Cameroun | poulet, bananes plantains mûres frites, carotte, haricots verts, poivron, tomate et oignon | frire le poulet et le plantain, faire sauter avec les légumes | soir, midi |  |
| Poisson braisé | Cameroun, Gabon, Congo | poisson entier (bar, maquereau, tilapia), ail, gingembre, oignon, piment, persil ou céleri | mariner aux épices pilées, griller à la braise | soir |  |
| Soya (brochettes de bœuf) | Cameroun, Tchad | bœuf en fines lamelles, poudre d'arachide, épices (piment, gingembre, poivre), oignon | enrober d'épices, griller en brochettes | encas, soir |  |
| Plantain mûr frit et haricots | Cameroun, Gabon | bananes plantains mûres, haricots rouges, huile de palme ou huile, oignon, tomate | frire le plantain, mijoter les haricots en sauce | midi, soir, matin | vegan |
| Sauce d'arachide (poulet ou poisson) | Cameroun, Centrafrique, Tchad, Congo | pâte d'arachide, poulet, viande ou poisson fumé, tomate, oignon, piment | délayer la pâte d'arachide, mijoter jusqu'à ce que l'huile remonte | midi, soir |  |
| Bâtons de manioc (miondo, chikwangue, kwanga) | Cameroun, Gabon, Congo, RDC, Centrafrique | manioc roui (fermenté), feuilles de marantacée ou de bananier | rouir et piler le manioc, envelopper et cuire à la vapeur | midi, soir, matin | vegan |
| Poulet nyembwe | Gabon | poulet, nyembwe (crème de noix de palme), oignon, ail, tomate, piment | dorer le poulet, mijoter dans la crème de palme | midi, soir |  |
| Sauce odika (chocolat indigène) | Gabon, Cameroun (sud) | pain d'odika (amandes de mangue sauvage), poisson fumé ou viande, piment, oignon | râper et faire fondre l'odika, mijoter la viande ou le poisson dedans | midi, soir |  |
| Atanga (safou) bouilli ou braisé | Gabon, Cameroun, Congo, RDC | safous (prunes africaines), sel, pain ou bâton de manioc | ramollir à l'eau chaude ou sur la braise | encas, matin | vegan |
| Saka-saka (pondu, ngunza) | Congo, RDC, Centrafrique, Gabon | feuilles de manioc pilées, huile de palme, oignon et ail, poisson salé ou fumé (souvent), poireau ou aubergine, pâte d'arachide (selon la région) | piler les feuilles, cuire longuement (plusieurs heures) | midi, soir |  |
| Poulet à la moambe | RDC, Congo, Gabon | poulet, moambe (sauce de noix de palme), oignon, ail, tomate, piment | dorer le poulet, mijoter dans la sauce de palme | midi, soir |  |
| Liboké de poisson | Congo, RDC | poisson (capitaine, tilapia, silure), tomate, oignon, ail, piment, feuilles de bananier ou de marantacée | envelopper le poisson assaisonné en papillote, cuire à la braise ou à la vapeur | midi, soir |  |
| Madesu (haricots en sauce) | RDC, Congo | haricots rouges ou blancs, huile de palme ou huile, oignon, tomate, ail | cuire les haricots, mijoter en sauce tomate | midi, soir | vegan |
| Loso na madesu (riz et haricots) | RDC, Congo | riz blanc, haricots en sauce (madesu), oignon, tomate, huile | cuire le riz, servir avec les haricots en sauce | midi, soir | vegan |
| Fufu (fufu de manioc ou de maïs) | RDC, Congo, Centrafrique (gozo), Cameroun | farine de manioc et/ou de maïs, eau | verser la farine dans l'eau bouillante, remuer vigoureusement jusqu'à pâte ferme | midi, soir | vegan |
| Fumbwa | RDC, Congo | feuilles de fumbwa (gnetum) émincées, pâte d'arachide, huile de palme, poisson fumé ou salé, oignon, tomate | émincer finement les feuilles, mijoter avec l'arachide | midi, soir |  |
| Makayabu (poisson salé en sauce) | RDC, Congo | morue ou poisson salé, tomate, oignon, huile de palme ou huile, piment | dessaler le poisson, mijoter en sauce tomate | midi, soir |  |
| Lenga-lenga (amarante en sauce) | RDC, Congo | feuilles d'amarante, oignon, tomate, huile de palme ou pâte d'arachide, poisson fumé (facultatif) | hacher les feuilles, faire revenir et mijoter brièvement | midi, soir |  |
| Ngai-ngai (oseille de Guinée en sauce) | RDC, Congo | feuilles d'oseille de Guinée (bissap), riz ou fufu, oignon, huile de palme, poisson salé ou fumé | cuire les feuilles acidulées, mijoter avec le poisson | midi, soir |  |
| Mbika (pâte de graines de courge) | RDC, Congo | graines de courge moulues (mbika), poisson fumé ou crevettes, oignon, piment, feuilles de bananier | mélanger la pâte de graines aux condiments, cuire en papillote ou en sauce | midi, soir |  |
| Ntaba (chèvre grillée) | RDC, Congo | viande de chèvre, oignon, piment, sel, plantain frit ou kwanga (accompagnement) | mariner, griller à la braise | soir, encas |  |
| Makemba (plantain frit) | RDC, Congo | banane plantain mûre, huile de friture, sel | frire en tranches | encas, midi, matin | vegan |
| Koko (gnetum à l'arachide) | Centrafrique | feuilles de koko (gnetum) émincées, pâte d'arachide, viande fumée ou poisson fumé, oignon, piment, gozo (boule de manioc) | émincer finement les feuilles, mijoter avec la pâte d'arachide | midi, soir |  |
| Kanda (boulettes de viande ou de poisson) | Centrafrique | viande hachée ou poisson pilé, graines de courge moulues, oignon, piment, sauce tomate | façonner des boulettes avec les graines, les cuire dans une sauce | midi, soir |  |
| Boule (aïch) et sauce gombo | Tchad | farine de mil, sorgho ou maïs, gombo séché ou frais, viande séchée ou fraîche, oignon, tomate séchée, piment | cuire la farine en pâte ferme, préparer une sauce gluante | midi, soir |  |
| Daraba | Tchad, Centrafrique | gombo, aubergine, patate douce ou courge, pâte d'arachide, tomate, oignon | mijoter les légumes, lier à la pâte d'arachide | midi, soir | vegan |
| Kissar (galette fermentée de sorgho) | Tchad | farine de sorgho ou de mil, eau, levain (pâte fermentée), sauce (viande, gombo ou lait caillé) en accompagnement | laisser fermenter la pâte, étaler en fines crêpes sur une plaque chaude | matin, soir | vegan |
| Mouloukhiya (sauce de corète) | Tchad | feuilles de corète séchées en poudre, viande, oignon, ail, tomate | délayer la poudre de feuilles, mijoter avec la viande | midi, soir |  |
| Bouillie de mil (madida) | Tchad, Cameroun (Nord) | farine de mil ou de sorgho, eau, sucre, citron, tamarin ou lait caillé | délayer la farine, cuire en remuant | matin | vegan |
| Calulu | São Tomé-et-Principe | poisson fumé et frais (ou poulet), huile de palme, légumes-feuilles et herbes locales, gombo, aubergine, tomate et oignon | mijoter longuement poisson et feuilles à l'huile de palme | midi, soir |  |
| Pepesup (soupe de poisson pimentée) | Guinée équatoriale | poisson, piment, oignon, tomate, feuilles odorantes (basilic) | pocher le poisson dans un bouillon pimenté | midi, soir |  |

<a id="afrique-est"></a>

## Afrique de l'Est (60 plats)

| Plat | Pays | Ingrédients essentiels | Techniques | Moments | Régime |
|---|---|---|---|---|---|
| Injera | Éthiopie, Érythrée | farine de teff (ou mélange teff, orge, sorgho), eau, levain de la pâte précédente (ersho) | fermenter la pâte plusieurs jours, cuire en grande galette sur plaque couverte | matin, midi, soir | vegan |
| Shiro wat | Éthiopie, Érythrée | farine de pois chiche (ou de fèves, pois), oignon, ail, berbéré, huile (ou beurre clarifié épicé, niter kibbeh) | fondre l'oignon sans matière grasse puis à l'huile, délayer la farine dans le bouillon et mijoter | matin, midi, soir | vegan |
| Misir wat | Éthiopie, Érythrée | lentilles corail, oignon, ail, berbéré, huile (ou niter kibbeh) | fondre longuement l'oignon, mijoter les lentilles dans la sauce au berbéré | midi, soir | vegan |
| Kik alicha | Éthiopie, Érythrée | pois cassés jaunes, oignon, ail, gingembre, curcuma, huile | mijoter les pois cassés jusqu'à purée épaisse | midi, soir | vegan |
| Gomen (chou vert à l'éthiopienne) | Éthiopie, Érythrée | chou cavalier (ou chou kale, blettes), oignon, ail, piment vert, huile (ou niter kibbeh) | émincer finement, étuver à couvert | midi, soir | vegan |
| Atkilt wat | Éthiopie, Érythrée | chou blanc, carotte, pomme de terre, oignon, curcuma, huile | étuver les légumes à couvert | midi, soir | vegan |
| Fosolia (haricots verts et carottes) | Éthiopie | haricots verts, carotte, oignon, ail, huile | sauter puis étuver | midi, soir | vegan |
| Azifa (salade de lentilles) | Éthiopie | lentilles vertes, oignon rouge, piment vert, jus de citron, moutarde, huile | cuire les lentilles et les servir froides assaisonnées | midi, soir | vegan |
| Doro wat | Éthiopie, Érythrée (tsebhi derho) | poulet en morceaux, oignon (beaucoup), berbéré, niter kibbeh, œufs durs, ail et gingembre | fondre longuement l'oignon à sec, mijoter le poulet dans la sauce | midi, soir |  |
| Tibs | Éthiopie, Érythrée | bœuf ou agneau en dés, oignon, piment vert, romarin, niter kibbeh (ou huile) | sauter à feu vif | matin, midi, soir |  |
| Zigni | Érythrée | bœuf (ou agneau) en morceaux, oignon, berbéré, tomate, ail | fondre l'oignon, mijoter la viande dans la sauce pimentée | midi, soir |  |
| Firfir (fit-fit) | Éthiopie, Érythrée | injera (ou kitcha) de la veille, oignon, berbéré, niter kibbeh (ou huile), sauce restante (shiro, wat) | déchirer le pain, le mélanger à la sauce chaude | matin, midi | végétarien |
| Chechebsa (kita firfir) | Éthiopie, Érythrée | farine de blé, niter kibbeh, berbéré, miel (facultatif) | cuire une galette épaisse, la déchiqueter et la mélanger au beurre épicé | matin | végétarien |
| Genfo (ga'at) | Éthiopie, Érythrée | farine d'orge (ou de blé), eau, niter kibbeh, berbéré | cuire une bouillie très épaisse en remuant, creuser un puits pour le beurre épicé | matin | végétarien |
| Kinche | Éthiopie | blé ou orge concassé, eau, niter kibbeh, sel | cuire le grain concassé à l'eau, enrober de beurre épicé | matin | végétarien |
| Enkulal firfir (œufs brouillés à l'éthiopienne) | Éthiopie | œufs, oignon, tomate, piment vert, huile (ou niter kibbeh) | fondre oignon et tomate, brouiller les œufs dedans | matin | végétarien |
| Ful medames (foul) | Soudan, Soudan du Sud, Éthiopie, Érythrée, Djibouti | fèves sèches (ful), oignon, tomate, cumin, huile (ou huile de sésame), piment | cuire longuement les fèves, écraser grossièrement et assaisonner | matin, soir | vegan |
| Ta'amia (falafel de fèves) | Soudan | fèves sèches trempées (ou pois chiches), oignon, ail, coriandre fraîche, cumin | mixer les fèves crues, frire en boulettes | matin, encas | vegan |
| Kisra | Soudan, Soudan du Sud | farine de sorgho, eau, levain | fermenter la pâte, étaler en voile très fin sur plaque chaude | midi, soir | vegan |
| Asida (aseeda) | Soudan, Soudan du Sud | farine de sorgho (ou de blé, de maïs), eau, sel | cuire une pâte ferme en remuant, mouler en dôme et servir avec une sauce (mulah) | midi, soir | vegan |
| Mulah (sauce soudanaise au gombo séché) | Soudan, Soudan du Sud | gombo séché en poudre (weika), viande (bœuf ou agneau) en petits morceaux, oignon, tomate, ail | fondre l'oignon, mijoter et lier avec la poudre de gombo | midi, soir |  |
| Bamia (ragoût de gombos) | Soudan | gombos, viande (agneau ou bœuf), tomate (ou concentré), oignon, ail | revenir la viande, mijoter avec les gombos dans la tomate | midi, soir |  |
| Salata aswad (salade d'aubergine) | Soudan | aubergine, pâte d'arachide, jus de citron, ail, piment | frire ou griller l'aubergine, écraser avec la pâte d'arachide | midi, soir | vegan |
| Canjeero (lahoh) | Somalie, Djibouti | farine de blé (ou de sorgho, maïs), eau, levure | laisser fermenter la pâte, cuire en crêpe fine d'un seul côté | matin | vegan |
| Malawax | Somalie, Djibouti | farine de blé, œufs, lait, sucre, cardamome | cuire en crêpes fines | matin, encas | végétarien |
| Suqaar | Somalie, Djibouti | bœuf, chèvre ou agneau en petits dés, oignon, poivron, tomate, xawaash (mélange d'épices somalien) | saisir la viande en petits dés, sauter avec les légumes | matin, midi, soir |  |
| Bariis iskukaris | Somalie, Djibouti | riz basmati, viande de chèvre, agneau ou poulet, oignon, tomate, xawaash (cumin, coriandre, cardamome, cannelle), raisins secs (facultatif) | revenir les épices et l'oignon, cuire le riz dans le bouillon | midi, soir |  |
| Skoudehkaris | Djibouti | riz, agneau (ou chèvre), tomate, oignon, cardamome, cumin, clou de girofle | mijoter la viande dans la tomate épicée, cuire le riz dans la sauce | midi, soir |  |
| Fah-fah (soupe djiboutienne) | Djibouti, Somalie | viande de chèvre (ou agneau), pomme de terre, carotte, oignon, piment vert, coriandre fraîche | mijoter la viande en bouillon, ajouter les légumes | matin, soir |  |
| Sambusa (sambuusa, samosa) | Somalie, Djibouti, Éthiopie, Kenya, Tanzanie, Ouganda | feuilles de pâte (farine, eau), viande hachée (ou lentilles), oignon, piment vert, coriandre fraîche | farcir en triangles, frire | encas |  |
| Chapati (chapo, sabaayad) | Kenya, Tanzanie, Ouganda, Somalie, Rwanda | farine de blé, eau, huile, sel | pétrir, rouler et replier en couches, cuire à la poêle | matin, midi, soir | vegan |
| Rolex (rolled eggs) | Ouganda | chapati, œufs, chou, tomate, oignon | cuire une omelette aux légumes, la rouler dans un chapati | matin, encas | végétarien |
| Mandazi (maandazi, mahamri) | Kenya, Tanzanie, Ouganda, Rwanda, Burundi | farine de blé, lait de coco (ou lait), sucre, cardamome, levure (ou levure chimique) | laisser lever, frire en triangles | matin, encas | végétarien |
| Uji | Kenya, Tanzanie, Ouganda | farine de mil, sorgho ou maïs, eau (ou lait), sucre, jus de citron (facultatif) | délayer la farine à froid, cuire en bouillie fluide | matin | vegan |
| Mbaazi wa nazi (pois d'Angole au coco) | Kenya (côte), Tanzanie | pois d'Angole, lait de coco, oignon, tomate, curcuma | cuire les pois, mijoter dans le lait de coco | matin, soir | vegan |
| Ugali (posho, sima, bugali) | Kenya, Tanzanie, Ouganda, Rwanda, Burundi | farine de maïs blanc (ou de manioc, de mil), eau, sel (facultatif) | verser la farine dans l'eau bouillante, remuer fort jusqu'à pâte ferme | midi, soir | vegan |
| Sukuma wiki | Kenya, Tanzanie | chou cavalier (ou kale), oignon, tomate, huile, sel | émincer finement, sauter rapidement | midi, soir | vegan |
| Mchicha | Tanzanie, Kenya | amarante (ou épinards), oignon, tomate, arachides pilées (ou lait de coco) | étuver les feuilles, lier avec l'arachide ou le coco | midi, soir | vegan |
| Githeri (makande) | Kenya, Tanzanie | maïs sec, haricots secs, oignon, tomate | cuire longuement maïs et haricots, sauter avec oignon et tomate | midi, soir | vegan |
| Mukimo (irio) | Kenya | pommes de terre, petits pois (ou haricots), maïs, feuilles vertes (citrouille, épinards) | cuire les légumes, écraser le tout ensemble | midi, soir | vegan |
| Kachumbari | Kenya, Tanzanie, Ouganda | tomate, oignon rouge, coriandre fraîche, jus de citron, piment | tailler finement, assaisonner cru | midi, soir | vegan |
| Nyama choma | Kenya, Tanzanie | viande de chèvre (ou bœuf), sel, kachumbari (en accompagnement) | griller lentement sur braises | midi, soir |  |
| Mshikaki | Tanzanie, Kenya | bœuf en cubes, ail et gingembre, jus de citron, piment, curry (ou épices) | mariner, griller en brochettes | encas, soir |  |
| Pilau | Kenya, Tanzanie, Zanzibar, Ouganda | riz, viande (bœuf, chèvre ou poulet), oignon, ail, pilau masala (cumin, cardamome, cannelle, clou de girofle, poivre) | brunir l'oignon et les épices, cuire le riz dans le bouillon de viande | midi, soir |  |
| Wali wa nazi (riz au coco) | Tanzanie, Kenya (côte) | riz, lait de coco, sel | cuire le riz par absorption dans le lait de coco | midi, soir | vegan |
| Maharage ya nazi (haricots au coco) | Tanzanie, Kenya | haricots rouges, lait de coco, oignon, tomate, curcuma (ou curry) | cuire les haricots, mijoter dans le lait de coco | midi, soir | vegan |
| Mchuzi wa samaki (curry de poisson) | Tanzanie, Kenya | poisson, tomate, oignon, lait de coco, curry (ou curcuma), ail | frire légèrement le poisson, mijoter dans la sauce | midi, soir |  |
| Samaki wa kupaka | Kenya (côte), Tanzanie, Zanzibar | poisson entier, lait de coco, jus de citron, ail, piment, curcuma | griller le poisson, le napper de sauce coco réduite | midi, soir |  |
| Kuku paka | Kenya (côte) | poulet, lait de coco, oignon, ail et gingembre, curcuma, piment | griller le poulet, le mijoter dans la sauce coco | midi, soir |  |
| Omena (dagaa, ndagala) | Kenya, Tanzanie, Ouganda, Burundi, Rwanda | petits poissons séchés, tomate, oignon, huile | rincer et sauter les poissons, mijoter avec tomate et oignon | midi, soir |  |
| Matoke (ndizi nyama) | Ouganda, Tanzanie, Rwanda, Burundi, Kenya | bananes plantain vertes, oignon, tomate, viande de bœuf (facultatif) | éplucher les bananes vertes, mijoter en ragoût (ou cuire à la vapeur et écraser) | midi, soir |  |
| Mtori | Tanzanie (Kilimandjaro) | bananes plantain vertes, bœuf (avec os), oignon, beurre (ou lait) | cuire bananes et viande en bouillon, écraser en soupe épaisse | matin, soir |  |
| Luwombo | Ouganda | poulet (ou bœuf, poisson fumé), pâte d'arachide, oignon, tomate, feuilles de bananier | envelopper dans des feuilles de bananier, cuire à la vapeur | midi, soir |  |
| Isombe | Rwanda, Burundi | feuilles de manioc pilées, aubergine, épinards, pâte d'arachide, huile de palme, oignon | piler les feuilles, mijoter longuement | midi, soir | vegan |
| Ibiharage (haricots à l'huile de palme) | Rwanda, Burundi | haricots secs, oignon, huile de palme (ou huile), sel | cuire les haricots, faire revenir l'oignon et les mélanger | midi, soir | vegan |
| Chipsi mayai | Tanzanie | pommes de terre en frites, œufs, sel, kachumbari (facultatif) | frire les pommes de terre, les prendre dans une omelette | midi, soir, encas | végétarien |
| Viazi karai | Kenya (côte), Tanzanie | pommes de terre, farine de pois chiche, curcuma, ail et gingembre, piment | cuire les pommes de terre, enrober de pâte et frire | encas | vegan |
| Ndizi kaanga (bananes plantain frites) | Tanzanie, Kenya, Ouganda | bananes plantain, huile, sel | frire en tranches | matin, encas | vegan |
| Kolo | Éthiopie, Érythrée | grains d'orge (ou de blé), arachides, pois chiches grillés (facultatif) | griller à sec les grains | encas | vegan |
| Dabo kolo | Éthiopie, Érythrée | farine de blé, huile, berbéré, sucre, sel | former de petits boudins coupés en dés, griller à sec à la poêle | encas | vegan |

<a id="afrique-australe"></a>

## Afrique australe (53 plats)

| Plat | Pays | Ingrédients essentiels | Techniques | Moments | Régime |
|---|---|---|---|---|---|
| Pap (sadza, nshima, nsima, xima) | Afrique du Sud, Zimbabwe, Zambie, Malawi, Mozambique, Lesotho, Eswatini, Botswana | farine de maïs blanc, eau, sel | verser la farine dans l'eau bouillante, remuer fort jusqu'à pâte ferme | midi, soir | vegan |
| Soft porridge (bouillie de maïs) | Afrique du Sud, Zimbabwe, Zambie, Malawi, Botswana | farine de maïs (ou maltabella, sorgho), eau, lait, sucre, beurre (facultatif) | cuire en bouillie fluide en remuant | matin | végétarien |
| Bota (bouillie au beurre de cacahuète) | Zimbabwe | farine de maïs, beurre de cacahuète, eau, sucre (ou sel) | cuire une bouillie fluide, lier au beurre de cacahuète | matin | vegan |
| Ting (bouillie de sorgho fermentée) | Botswana, Afrique du Sud | farine de sorgho, eau, levain (pâte fermentée) | fermenter la pâte un à deux jours, cuire en bouillie (ou en pâte ferme) | matin, soir | vegan |
| Oshifima | Namibie | farine de mil perlé (mahangu), eau, sel | cuire en pâte ferme comme le pap | midi, soir | vegan |
| Umphokoqo (pap émietté au lait caillé) | Afrique du Sud, Eswatini, Lesotho | farine de maïs, eau, lait fermenté (amasi, ou lait ribot) | cuire le pap sec et friable, servir froid nappé de lait fermenté | matin, midi, soir | végétarien |
| Rusks (beskuit) | Afrique du Sud, Namibie | farine (ou farine complète), beurre, babeurre (ou lait), sucre, levure chimique | cuire en pain, couper et sécher longuement au four | matin, encas | végétarien |
| Vetkoek (amagwinya, magwinya) | Afrique du Sud, Namibie, Botswana, Zimbabwe | farine de blé, levure, sucre, eau, huile de friture | laisser lever la pâte, frire en boules | matin, encas, midi | vegan |
| Mandasi (beignets) | Malawi, Zambie, Mozambique | farine de blé, sucre, levure (ou levure chimique), lait (ou eau) | frire en boules | matin, encas | végétarien |
| Chakalaka | Afrique du Sud | haricots blancs à la tomate, oignon, poivron, carotte râpée, tomate, curry en poudre | revenir les légumes avec le curry, mijoter avec les haricots | midi, soir | vegan |
| Morogo (imifino, moroho) | Afrique du Sud, Botswana, Lesotho, Eswatini | feuilles vertes (épinards, amarante, feuilles de citrouille), oignon, tomate, huile | étuver les feuilles, sauter avec oignon et tomate | midi, soir | vegan |
| Umngqusho (samp and beans) | Afrique du Sud | maïs concassé (samp), haricots secs (sugar beans), oignon, sel | tremper la veille, mijoter longuement | midi, soir | vegan |
| Dombolo (dumplings vapeur) | Afrique du Sud | farine de blé, levure, sucre, eau | laisser lever, cuire à la vapeur sur un ragoût | midi, soir | vegan |
| Bobotie | Afrique du Sud | viande hachée (bœuf ou agneau), pain trempé dans le lait, oignon, curry en poudre, chutney (ou raisins secs), œufs battus au lait | cuire la viande épicée, napper d'œufs et cuire au four | midi, soir |  |
| Bredie (tomatie bredie) | Afrique du Sud | agneau (ou mouton) avec os, tomate, oignon, pomme de terre, cannelle ou clou de girofle | revenir la viande, mijoter longuement | midi, soir |  |
| Potjiekos | Afrique du Sud, Namibie | viande (agneau, bœuf ou poulet), pomme de terre, carotte, oignon, courge (ou autres légumes) | étager viande et légumes en cocotte en fonte, mijoter longuement sans remuer | midi, soir |  |
| Curry du Cap (Cape Malay curry) | Afrique du Sud | poulet (ou agneau), oignon, tomate, pomme de terre, épices (curry, cannelle, cardamome, curcuma) | revenir les épices, mijoter | midi, soir |  |
| Bunny chow | Afrique du Sud (Durban) | pain de mie non tranché, curry de viande (agneau, poulet) ou de haricots, pomme de terre | évider un quart de pain, le remplir de curry | midi |  |
| Sosaties | Afrique du Sud | agneau (ou poulet) en cubes, oignon, abricots secs, curry en poudre, vinaigre | mariner une nuit, griller en brochettes | midi, soir |  |
| Frikkadelle | Afrique du Sud | viande hachée, pain trempé, oignon, œuf, muscade ou coriandre | former des boulettes, frire ou cuire au four | midi, soir |  |
| Ingelegde vis (pickled fish) | Afrique du Sud | poisson blanc ferme, oignon, vinaigre, curry en poudre, sucre | frire le poisson, le mariner dans la sauce vinaigrée au curry | midi, soir |  |
| Tamatie smoor (sauce tomate-oignon) | Afrique du Sud | tomate, oignon, sucre, huile | étuver longuement tomate et oignon | matin, midi, soir | vegan |
| Pampoenkoekies (beignets de courge) | Afrique du Sud | courge (citrouille, butternut), farine, œuf, levure chimique, sucre et cannelle | écraser la courge cuite, frire en petites galettes | encas, soir | végétarien |
| Koeksisters | Afrique du Sud | farine, beurre, lait, levure chimique, sirop de sucre au citron (ou épices) | tresser la pâte, frire et plonger dans le sirop froid | encas | végétarien |
| Melktert | Afrique du Sud | lait, œufs, sucre, farine (ou maïzena), pâte sablée, cannelle | cuire une crème au lait, garnir un fond de tarte | encas | végétarien |
| Samoosas | Afrique du Sud, Mozambique (chamuças) | feuilles de pâte, viande hachée (ou légumes), oignon, épices (curry, cumin), coriandre fraîche | farcir en triangles, frire | encas |  |
| Roosterkoek | Afrique du Sud, Namibie | farine de blé, levure, sucre, sel, eau | former des petits pains, cuire sur la grille du barbecue | midi, soir, encas | vegan |
| Muriwo une dovi (légumes verts au beurre de cacahuète) | Zimbabwe | feuilles vertes (chou cavalier, épinards, feuilles de citrouille), beurre de cacahuète, tomate, oignon | étuver les feuilles, lier au beurre de cacahuète | midi, soir | vegan |
| Mupunga une dovi (riz au beurre de cacahuète) | Zimbabwe | riz, beurre de cacahuète, eau, sel | cuire le riz, y incorporer le beurre de cacahuète en fin de cuisson | midi, soir | vegan |
| Nhopi (purée de courge) | Zimbabwe | courge (citrouille), beurre de cacahuète, farine de maïs (facultatif), sel ou sucre | cuire et écraser la courge, lier au beurre de cacahuète | matin, midi, soir | vegan |
| Nyama (ragoût de bœuf à la tomate) | Zimbabwe, Zambie, Malawi | bœuf en morceaux, oignon, tomate, huile, sel | bouillir la viande, la frire puis mijoter avec oignon et tomate | midi, soir |  |
| Kapenta (matemba, usipa) | Zimbabwe, Zambie, Malawi | petits poissons séchés, tomate, oignon, huile | rincer les poissons, frire puis mijoter avec tomate et oignon | midi, soir |  |
| Ifisashi | Zambie | feuilles vertes (épinards, feuilles de citrouille, chou), arachides crues pilées, tomate, oignon | mijoter les arachides pilées en sauce, y cuire les feuilles | midi, soir | vegan |
| Delele (gombos) | Zambie, Zimbabwe, Malawi | gombos, tomate, oignon, bicarbonate (ou sel de potasse) | hacher les gombos, cuire pour obtenir une sauce filante | midi, soir | vegan |
| Maputi (maïs soufflé) | Zimbabwe, Zambie | maïs sec, huile (facultatif), sel | faire éclater les grains à la poêle couverte | encas | vegan |
| Chambo | Malawi | tilapia (chambo), tomate, oignon, huile, sel | frire ou griller le poisson, servir avec une sauce tomate | midi, soir |  |
| Futali | Malawi | patate douce (ou citrouille), arachides pilées, eau, sel | cuire la patate douce, écraser avec les arachides | matin, midi | vegan |
| Zitumbuwa (beignets de banane) | Malawi | bananes mûres, farine de maïs, sucre, sel | écraser les bananes avec la farine, frire en petites boules | matin, encas | vegan |
| Matapa (kizaca) | Mozambique, Angola | feuilles de manioc pilées, arachides pilées, lait de coco, ail, oignon | piler les feuilles, mijoter longuement avec arachides et coco | midi, soir | vegan |
| Caril de camarão | Mozambique | crevettes, lait de coco, tomate, oignon, ail, curry en poudre | revenir oignon et tomate, mijoter les crevettes dans le coco | midi, soir |  |
| Frango piri-piri | Mozambique | poulet, piment piri-piri, ail, jus de citron, huile | mariner, griller en arrosant de sauce | midi, soir |  |
| Mucapata | Mozambique | riz, haricots (feijão nhemba ou niébé), lait de coco, sel | cuire les haricots, cuire le riz avec eux dans le lait de coco | midi, soir | vegan |
| Badjias | Mozambique | haricots niébé trempés et pilés, oignon, piment, coriandre fraîche | mixer les haricots crus, frire en boulettes | encas, matin | vegan |
| Muamba de galinha | Angola | poulet, huile de palme (ou pâte de noix de palme), gombos, courge, ail, oignon | revenir le poulet, mijoter dans la sauce de palme | midi, soir |  |
| Funge (funje) | Angola | farine de manioc (ou de maïs), eau, sel (facultatif) | remuer la farine dans l'eau bouillante jusqu'à pâte élastique | midi, soir | vegan |
| Calulu | Angola | poisson séché et poisson frais (ou viande séchée), gombos, feuilles vertes (patate douce, épinards), tomate, oignon, huile de palme | étager poissons et légumes, mijoter longuement | midi, soir |  |
| Feijão de óleo de palma (haricots à l'huile de palme) | Angola | haricots secs (feijão manteiga), huile de palme, oignon, ail | cuire les haricots, les mijoter dans l'huile de palme | midi, soir | vegan |
| Mufete | Angola | poisson grillé, haricots à l'huile de palme, patate douce, banane plantain, manioc, oignon au vinaigre | griller le poisson, servir avec les accompagnements bouillis | midi |  |
| Feijoada | Angola, Mozambique | haricots secs, viande de porc (ou chouriço), oignon, tomate, chou ou carotte | mijoter longuement haricots et viande | midi, soir |  |
| Seswaa | Botswana | bœuf (morceaux avec os), oignon (facultatif), sel, eau | bouillir très longuement, effilocher la viande au pilon | midi, soir |  |
| Kapana | Namibie | bœuf en petits morceaux, sel, piment, tomate et oignon crus (accompagnement) | griller sur braises | encas, midi |  |
| Likhobe (maïs et haricots) | Lesotho | maïs sec (ou sorgho), haricots secs, sel | tremper, cuire longuement ensemble | midi, soir | vegan |
| Sidvudvu (bouillie de courge) | Eswatini | courge (citrouille), farine de maïs, lait (facultatif), sel ou sucre | cuire la courge, lier à la farine de maïs en bouillie | matin | végétarien |

<a id="ocean-indien"></a>

## Océan Indien (44 plats)

| Plat | Pays | Ingrédients essentiels | Techniques | Moments | Régime |
|---|---|---|---|---|---|
| Romazava | Madagascar | viande de zébu (ou bœuf, porc), brèdes (anamamy, anamalaho, petsaï, cresson), tomate, oignon, gingembre, ail | revenir la viande, mijoter en bouillon avec les brèdes | midi, soir |  |
| Ravitoto sy henakisoa | Madagascar | feuilles de manioc pilées, porc gras, ail, oignon | piler les feuilles, mijoter longuement avec le porc | midi, soir |  |
| Akoho sy voanio (poulet au coco) | Madagascar | poulet, lait de coco, tomate, oignon, ail, gingembre | revenir le poulet, mijoter dans le lait de coco | midi, soir |  |
| Hen'omby ritra | Madagascar | bœuf (zébu) en morceaux, oignon, ail, tomate, sel | mijoter jusqu'à réduction complète de la sauce | midi, soir |  |
| Tsaramaso | Madagascar | haricots secs (blancs ou rouges), porc (facultatif), tomate, oignon, ail | cuire les haricots, mijoter avec tomate et oignon | midi, soir |  |
| Voanjobory sy henakisoa | Madagascar | pois de terre (voandzou), porc, tomate, oignon, ail | cuire longuement les pois, mijoter avec le porc | midi, soir |  |
| Vary amin'anana | Madagascar | riz, brèdes hachées, tomate, gingembre, viande hachée ou porc (facultatif) | cuire le riz avec beaucoup d'eau et les brèdes | matin, soir |  |
| Vary sosoa | Madagascar | riz (ou riz de la veille), eau, sel | cuire le riz longtemps dans beaucoup d'eau jusqu'à consistance de bouillie | matin | vegan |
| Mofo gasy | Madagascar | farine de riz, sucre, levure, lait de coco (ou eau) | laisser fermenter la pâte, cuire dans un moule à alvéoles | matin, encas | vegan |
| Mokary | Madagascar | farine de riz, lait de coco, sucre, levure | laisser lever, cuire dans un moule à alvéoles | matin, encas | vegan |
| Mofo anana (beignets de brèdes) | Madagascar | brèdes hachées, farine, oignon (ou ciboule), tomate, piment | mélanger en pâte épaisse, frire à la cuillère | matin, encas | vegan |
| Koba ravina | Madagascar | farine de riz, arachides grillées pilées, sucre, banane, feuilles de bananier | envelopper en boudin dans les feuilles, cuire longuement à l'eau | encas | vegan |
| Lasary voatabia | Madagascar | tomate, oignon, ciboule, jus de citron, piment | tailler finement, assaisonner cru | midi, soir | vegan |
| Mi sao (mine frit) | Madagascar, Maurice, La Réunion | nouilles de blé, légumes (chou, carotte, haricots verts), viande ou crevettes (facultatif), ail, sauce soja | cuire les nouilles, sauter à feu vif avec les légumes | midi, soir, encas |  |
| Masikita | Madagascar | bœuf (zébu) en petits morceaux, ail, sel, poivre | mariner, griller en petites brochettes | encas |  |
| Samoussa (sambos, sambusa) | Madagascar, Maurice, La Réunion, Comores, Mayotte | feuilles de pâte, viande hachée, thon ou légumes, oignon, curry (ou massalé), coriandre fraîche | farcir en triangles, frire | encas |  |
| Cari poulet | La Réunion, Maurice (kari poulet) | poulet, oignon, tomate, ail et gingembre, curcuma (safran péi), thym | revenir le poulet, mijoter avec tomate et épices | midi, soir |  |
| Cari poisson (kari poisson) | La Réunion, Maurice, Seychelles | poisson, oignon, tomate, ail et gingembre, curcuma (ou poudre de curry) | revenir les épices, mijoter doucement le poisson | midi, soir |  |
| Rougail saucisse | La Réunion | saucisses fumées, tomate, oignon, ail, piment, thym | blanchir et dorer les saucisses, mijoter avec tomate et oignon | midi, soir |  |
| Rougail morue (rougaille poisson salé) | La Réunion, Maurice | morue salée (poisson salé), tomate, oignon, ail, piment, thym | dessaler la morue, frire puis mijoter avec tomate et oignon | midi, soir |  |
| Massalé cabri | La Réunion, Maurice | cabri (ou agneau), massalé, oignon, tomate, ail et gingembre | revenir la viande avec les épices, mijoter longuement | midi, soir |  |
| Vindaye poisson | Maurice, La Réunion | poisson, graines de moutarde, curcuma, oignon, ail, vinaigre | frire le poisson, napper de sauce vinaigrée à la moutarde | midi, soir |  |
| Grains (lentilles, haricots, pois du Cap) | La Réunion, Maurice | lentilles (ou haricots rouges, pois du Cap), oignon, ail, thym, tomate (facultatif) | cuire les légumineuses en sauce | midi, soir | vegan |
| Rougail tomate | La Réunion, Maurice | tomate, oignon, gingembre, piment, combava ou citron | tailler finement ou piler, assaisonner cru | midi, soir | vegan |
| Brèdes sautées (chouchou, mafane, chou de Chine) | La Réunion, Maurice, Madagascar | brèdes (feuilles de chouchou, cresson, petsaï, épinards), ail, oignon, huile | sauter ou étuver rapidement | midi, soir | vegan |
| Achards de légumes (lasary legioma) | La Réunion, Maurice, Madagascar | chou, carotte, haricots verts, curcuma, vinaigre, huile | blanchir ou faire dégorger les légumes, confire dans l'huile épicée | midi, soir | vegan |
| Gâteau piment (bonbon piment) | Maurice, La Réunion | pois cassés jaunes trempés, oignon (ou ciboule), piment, cumin | mixer les pois crus, frire en petites boules | encas, matin | vegan |
| Bouchons | La Réunion | porc haché, pâte (farine, eau), ail, ciboule, sauce soja | farcir de petits bouchons de pâte, cuire à la vapeur | encas, soir |  |
| Boulettes (dim sum mauricien) | Maurice | chouchou râpé (ou poisson, crevettes, poulet), farine de manioc (ou fécule), ail, ciboule | façonner en boulettes, cuire à la vapeur et servir en bouillon | encas, midi |  |
| Gâteau patate | La Réunion, Maurice | patate douce, sucre, beurre, œufs (ou farine), vanille | écraser la patate douce, cuire au four (ou frire en galettes) | encas | végétarien |
| Dholl puri | Maurice | farine de blé, pois cassés jaunes cuits et moulus, cumin, curcuma, huile | farcir la pâte de pois moulus, étaler et cuire à la poêle | matin, midi, encas | vegan |
| Farata | Maurice, La Réunion | farine de blé, eau, huile (ou ghee), sel | étaler et replier en couches, cuire à la poêle | matin, midi, soir | vegan |
| Bol renversé | Maurice | riz, poulet (ou crevettes), légumes sautés (chou, carotte, champignons), œuf au plat, sauce soja | sauter viande et légumes, mouler en bol retourné sur le riz, œuf dessus | midi, soir |  |
| Briani (biryani mauricien) | Maurice | riz basmati, poulet (ou agneau), pomme de terre, yaourt, oignon frit, épices (cardamome, cannelle, safran) | mariner la viande, cuire en couches à l'étouffée | midi, soir |  |
| Halim | Maurice | lentilles et blé concassé, viande (bœuf ou agneau), oignon, ail et gingembre, épices (curcuma, garam masala) | mijoter longuement en soupe épaisse | soir, encas |  |
| Mataba (feuilles de manioc au coco) | Comores, Mayotte | feuilles de manioc pilées, lait de coco, ail, oignon, poisson (facultatif) | piler les feuilles, mijoter longuement dans le lait de coco | midi, soir |  |
| Mkatra foutra | Comores, Mayotte | farine de blé, lait de coco, levure, graines de sésame | laisser lever, cuire en galette à la poêle | matin, encas | vegan |
| Pilao (pilaou) | Comores, Mayotte | riz, viande (bœuf ou poulet), oignon, ail, épices (cardamome, cannelle, clou de girofle, cumin) | revenir viande et épices, cuire le riz dans le bouillon | midi, soir |  |
| Ntrovi (bananes vertes au coco) | Comores, Mayotte | bananes plantain vertes, lait de coco, poisson ou viande (facultatif), sel | mijoter les bananes dans le lait de coco | matin, midi, soir |  |
| Mabawa (ailes de poulet grillées) | Mayotte, Comores | ailes de poulet, ail, citron, épices (curry, piment) | mariner, griller au barbecue | encas, soir |  |
| Kari koko (poisson ou poulpe au coco) | Seychelles | poisson ou poulpe, lait de coco, oignon, ail et gingembre, curry en poudre | revenir les épices, mijoter dans le lait de coco | midi, soir |  |
| Ladob | Seychelles | banane plantain mûre (ou fruit à pain, patate douce), lait de coco, sucre, muscade, vanille | mijoter les fruits dans le lait de coco sucré | encas | vegan |
| Fruit à pain (frit, bouilli ou en ladob) | Seychelles, Maurice, La Réunion, Comores | fruit à pain, sel, huile (ou lait de coco) | bouillir, frire en chips ou griller | matin, encas, midi | vegan |
| Bouillon brèdes | Seychelles, Maurice, La Réunion | brèdes (feuilles vertes), ail, oignon, gingembre, eau | cuire rapidement les feuilles en bouillon léger | midi, soir | vegan |

<a id="maghreb"></a>

## Maghreb (49 plats)

| Plat | Pays | Ingrédients essentiels | Techniques | Moments | Régime |
|---|---|---|---|---|---|
| Couscous aux légumes | Maroc, Algérie, Tunisie, Libye, Mauritanie | semoule de couscous, viande (agneau, bœuf ou poulet), carotte, courgette, navet, chou ou courge, pois chiches, oignon | cuire la semoule à la vapeur au-dessus du bouillon, mijoter viande et légumes en bouillon | midi, soir |  |
| Couscous au poisson | Tunisie, Libye | semoule de couscous, poisson (mérou, daurade), tomate (ou concentré), harissa, pomme de terre, courge, poivron, oignon | cuire la semoule à la vapeur, pocher le poisson dans la sauce rouge | midi, soir |  |
| Tajine de poulet aux olives (tajine zitoune) | Maroc, Algérie | poulet, olives vertes, citron confit (ou jus de citron), oignon, gingembre, curcuma, safran, coriandre et persil | mijoter à l'étouffée, réduire la sauce | midi, soir |  |
| Tajine kefta aux œufs | Maroc | viande hachée, tomate, oignon, cumin et paprika, œufs, persil et coriandre | mijoter les boulettes dans la sauce tomate, cuire les œufs dessus | midi, soir |  |
| Tajine d'agneau aux pruneaux (lham lahlou) | Maroc, Algérie | agneau, pruneaux, oignon, cannelle, miel (ou sucre), amandes (facultatif) | mijoter la viande, confire les pruneaux dans la sauce | midi, soir |  |
| Tajine de légumes | Maroc | pomme de terre, carotte, courgette, tomate, oignon, épices (gingembre, curcuma, cumin) | disposer les légumes en dôme, cuire à l'étouffée | midi, soir | vegan |
| Djelbana (ragoût de petits pois) | Algérie, Maroc | petits pois, viande (agneau ou poulet), oignon, pomme de terre ou artichaut, ail | mijoter la viande, ajouter les petits pois | midi, soir |  |
| Chtitha djedj | Algérie | poulet, pois chiches, ail, paprika, piment (ou harissa), concentré de tomate | revenir le poulet, mijoter dans la sauce rouge à l'ail | midi, soir |  |
| Harira | Maroc | lentilles, pois chiches, tomate, céleri, coriandre, persil, viande (facultatif), farine (pour lier) | mijoter longuement, lier à la farine délayée (tadouira) | soir |  |
| Chorba frik | Algérie, Tunisie | blé vert concassé (frik), agneau (ou poulet), tomate, oignon, pois chiches, coriandre et menthe | revenir la viande, mijoter avec le frik en soupe | soir |  |
| Sharba libiya | Libye | agneau, pâtes langues d'oiseau (orzo), tomate (ou concentré), oignon, pois chiches, menthe séchée | revenir la viande et les épices, cuire les pâtes dans la soupe | soir |  |
| Bissara | Maroc | fèves sèches cassées (ou pois cassés), ail, cumin, paprika, huile d'olive | cuire et mixer en purée-soupe | matin, soir | vegan |
| Hssoua belboula (soupe d'orge) | Maroc | semoule d'orge (belboula), lait (ou eau), beurre (ou huile d'olive), sel | cuire la semoule en soupe épaisse | matin, soir | végétarien |
| Loubia (haricots blancs à la tomate) | Maroc, Algérie | haricots blancs, tomate, ail, cumin, paprika, huile d'olive | mijoter les haricots en sauce tomate épicée | midi, soir | vegan |
| Adess (lentilles mijotées) | Maroc, Algérie | lentilles vertes, tomate, oignon, ail, cumin et paprika, huile d'olive | mijoter les lentilles dans la sauce | midi, soir | vegan |
| Zaalouk | Maroc | aubergine, tomate, ail, cumin, paprika, huile d'olive | cuire l'aubergine, écraser et réduire avec la tomate | midi, soir | vegan |
| Taktouka (hmiss) | Maroc, Algérie | poivrons grillés, tomate, ail, huile d'olive, cumin (facultatif) | griller et peler les poivrons, les compoter avec la tomate | midi, soir | vegan |
| Salade méchouia | Tunisie | poivrons et piments grillés, tomate grillée, oignon grillé, ail, huile d'olive, thon et œuf dur (en garniture) | griller les légumes, peler et hacher finement | midi, soir |  |
| Salade tunisienne | Tunisie | tomate, concombre, oignon, poivron, huile d'olive, jus de citron | tailler en petits dés, assaisonner cru | midi, soir | vegan |
| Chakchouka (shakshuka) | Tunisie, Algérie, Libye, Maroc | tomate, poivron, oignon, ail, œufs, harissa (ou paprika) | compoter les légumes, pocher les œufs dans la sauce | matin, midi, soir | végétarien |
| Kafteji | Tunisie | pomme de terre, poivron, courge, tomate, œufs, harissa | frire les légumes séparément, hacher le tout avec les œufs | midi, encas | végétarien |
| Tajine tunisien | Tunisie | œufs, fromage râpé, viande (poulet) ou thon, pomme de terre, persil, pain rassis ou chapelure | mélanger le tout aux œufs battus, cuire au four | midi, soir, encas |  |
| Mloukhia | Tunisie, Libye | corète séchée en poudre, bœuf (ou agneau), huile d'olive, ail, feuilles de laurier | délayer la poudre dans l'huile, mijoter très longuement | midi, soir |  |
| Lablabi | Tunisie | pois chiches, pain rassis, ail, cumin, harissa, huile d'olive | cuire les pois chiches en bouillon, verser sur le pain émietté | matin, midi | vegan |
| Rfissa | Maroc | msemen (ou trid) émietté, poulet, lentilles, fenugrec, oignon, ras el hanout | mijoter le poulet aux épices, arroser les crêpes effilochées de bouillon | midi, soir |  |
| Chakhchoukha | Algérie | galettes de semoule (rougag) émiettées, agneau, pois chiches, tomate, oignon, piment | émietter les galettes, les arroser de sauce rouge | midi, soir |  |
| Rechta | Algérie | nouilles fraîches (rechta), poulet, navet, pois chiches, oignon, cannelle | cuire les nouilles à la vapeur, napper de sauce blanche | midi, soir |  |
| Rishda | Libye | nouilles fraîches (ou pâtes plates), agneau (ou poulet), pois chiches, tomate, oignon | cuire les pâtes à la vapeur ou dans la sauce, mijoter en sauce rouge | midi, soir |  |
| Berkoukes | Algérie, Maroc | grosses perles de pâte (berkoukes), viande (agneau ou poulet), tomate, courgette, carotte, pois chiches, oignon | mijoter la sauce, cuire les perles dedans | midi, soir |  |
| Mbakbka | Libye | pâtes courtes, viande (agneau ou poulet), concentré de tomate, oignon, pois chiches, épices (bzar, curcuma) | mijoter la sauce, cuire les pâtes directement dedans | midi, soir |  |
| Bazeen | Libye | farine d'orge, agneau, tomate (ou concentré), pomme de terre, œufs durs, oignon | cuire une pâte ferme d'orge en dôme, l'entourer de sauce à la viande | midi, soir |  |
| Mbatan | Libye | pommes de terre en tranches, viande hachée, persil, oignon, œufs, farine ou chapelure | farcir les tranches de pomme de terre, paner et frire | midi, soir |  |
| Pastilla au poulet | Maroc | feuilles de brick (warqa), poulet (ou pigeon), oignon, œufs, amandes, cannelle et sucre | mijoter la farce, monter en couches et cuire au four | midi, soir |  |
| Sardines à la chermoula | Maroc | sardines, coriandre et persil, ail, cumin et paprika, jus de citron, huile d'olive | mariner dans la chermoula, frire, griller ou cuire en tajine | midi, soir |  |
| Kesra (galette) | Algérie, Maroc | semoule, huile (ou beurre), eau, sel, levure (facultatif) | pétrir, cuire à la poêle en galette | matin, midi, soir | vegan |
| Msemen (rghaif, mlawi) | Maroc, Algérie, Tunisie | farine de blé, semoule fine, huile, beurre, sel | étaler très fin et plier en carré, cuire à la poêle | matin, encas | végétarien |
| Baghrir | Maroc, Algérie | semoule fine, farine, levure, levure chimique, eau | mixer une pâte fluide, cuire d'un seul côté jusqu'aux mille trous | matin, encas | vegan |
| Harcha | Maroc | semoule fine, beurre, lait, sucre, levure chimique | sabler la semoule au beurre, cuire à la poêle en galettes | matin, encas | végétarien |
| Mesfouf | Algérie, Tunisie | couscous fin, beurre, raisins secs (ou dattes), sucre (ou lait) | cuire le couscous à la vapeur, beurrer et sucrer | matin, soir | végétarien |
| Bsissa | Tunisie, Libye | farine d'orge ou de blé grillée, pois chiches grillés moulus, huile d'olive, sucre (ou dattes), épices (anis, fenouil) | délayer la farine grillée à l'huile ou à l'eau | matin, encas | vegan |
| Asida | Libye, Tunisie | farine de blé, eau, beurre (ou huile d'olive), miel ou sirop de dattes | cuire une pâte épaisse en remuant, creuser et napper de beurre et de miel | matin | végétarien |
| Sfenj | Maroc, Algérie, Tunisie, Libye | farine de blé, levure, eau, sel, huile de friture | laisser lever une pâte collante, frire en anneaux | matin, encas | vegan |
| Bambalouni | Tunisie | farine de blé, levure, sucre, eau, huile de friture | laisser lever, frire en anneaux et rouler dans le sucre | matin, encas | vegan |
| Maakouda | Maroc, Algérie, Tunisie | pommes de terre, œufs, persil, ail, cumin | écraser les pommes de terre cuites, frire en galettes | encas, soir | végétarien |
| Mhadjeb (mahjouba) | Algérie | semoule fine, tomate, oignon, poivron, piment, huile | étaler la pâte très fine, farcir de sauce et cuire à la poêle | encas, matin | vegan |
| Garantita (karantika) | Algérie (Oran), Maroc (Oriental) | farine de pois chiche, eau, huile, œuf (facultatif), cumin | mélanger en pâte fluide, cuire au four en flan | encas | végétarien |
| Bourek | Algérie | feuilles de brick (dioul), viande hachée, oignon, persil, œuf, fromage (facultatif) | rouler en cigares, frire | encas, soir |  |
| Brik à l'œuf | Tunisie | feuille de brick, œuf, thon, persil, câpres, pomme de terre (facultatif) | plier en triangle autour de l'œuf cru, frire rapidement | encas, soir |  |
| Fricassé | Tunisie | pâte levée frite, thon, œuf dur, pomme de terre, olives, harissa | frire les petits pains, les garnir | encas, midi |  |

<a id="asie-est"></a>

## Asie de l'Est (59 plats)

| Plat | Pays | Ingrédients essentiels | Techniques | Moments | Régime |
|---|---|---|---|---|---|
| Baizhou (congee, bouillie de riz) | Chine | riz, eau, accompagnements salés (légumes marinés zhacai, œuf salé, cacahuètes, tofu fermenté) | cuire longuement le riz dans beaucoup d'eau jusqu'à épaississement | matin, soir | végétarien |
| Youtiao (beignet allongé) | Chine, Taïwan | farine de blé, levure ou bicarbonate, sel, huile de friture | laisser reposer la pâte, frire deux bandes de pâte collées | matin, encas | vegan |
| Doujiang (lait de soja chaud) | Chine, Taïwan | soja jaune trempé, eau, sucre (ou version salée : sauce soja, vinaigre, ciboule) | mixer et filtrer le soja, faire bouillir le lait | matin | vegan |
| Baozi (brioches farcies à la vapeur) | Chine | farine de blé, levure, porc haché (ou farce de légumes : chou, champignons, vermicelles), ciboule, gingembre, sauce soja | pâte levée, farcir et plisser, cuire à la vapeur | matin, encas |  |
| Jianbing (crêpe salée de rue) | Chine du Nord (Tianjin, Shandong, Pékin) | farine (blé, haricot mungo), œuf, ciboule et coriandre, sauce de soja fermenté (tianmianjiang) et sauce pimentée, galette frite croustillante (ou youtiao) | étaler une crêpe fine sur plaque, casser l'œuf dessus et replier | matin, encas | végétarien |
| Cong you bing (galette à la ciboule) | Chine, Taïwan | farine de blé, ciboule, huile, sel | étaler, huiler, rouler en spirale, poêler | matin, encas | vegan |
| Chaye dan (œufs au thé) | Chine, Taïwan | œufs, thé noir, sauce soja, anis étoilé et cannelle | cuire les œufs, fêler la coquille, laisser infuser dans le bouillon | matin, encas | végétarien |
| Jiaozi (raviolis) | Chine (surtout le Nord) | farine de blé, porc haché, chou chinois (ou ciboule chinoise), gingembre, sauce soja, huile de sésame | pétrir une pâte à l'eau, farcir et plier, pocher (ou poêler : guotie) | midi, soir |  |
| Xihongshi chao jidan (œufs brouillés à la tomate) | Chine | tomates, œufs, ciboule, sucre, sel | brouiller les œufs au wok, sauter les tomates et remettre les œufs | midi, soir | végétarien |
| Chaofan (riz sauté) | Chine | riz cuit de la veille, œuf, ciboule, légumes en dés (petits pois, carotte), jambon, porc grillé ou crevettes, sauce soja | sauter à feu vif au wok, égrainer le riz froid | midi, soir |  |
| Mapo doufu (tofu sauce pimentée) | Chine (Sichuan) | tofu, porc ou bœuf haché, doubanjiang (pâte de fèves pimentée), poivre du Sichuan, ail, ciboule | revenir la viande et la pâte pimentée, mijoter le tofu, lier à la fécule | midi, soir |  |
| Gongbao jiding (poulet aux cacahuètes) | Chine (Sichuan, Guizhou) | poulet en dés, cacahuètes, piments secs, poivre du Sichuan, ciboule, vinaigre noir et sucre, sauce soja | mariner le poulet, sauter au wok à feu vif | midi, soir |  |
| Yuxiang qiezi (aubergines « parfum poisson ») | Chine (Sichuan) | aubergines, pâte de piment (doubanjiang ou paojiao), ail et gingembre, vinaigre, sucre, sauce soja | frire ou sauter les aubergines, napper de sauce aigre-douce pimentée | midi, soir |  |
| Suanla tudousi (pommes de terre en julienne aigres-piquantes) | Chine | pommes de terre, vinaigre, piments secs, ail, poivre du Sichuan | tailler en julienne et rincer l'amidon, sauter brièvement à feu vif | midi, soir | vegan |
| Qingchao shucai (légumes verts sautés à l'ail) | Chine | légume vert (pak-choï, choy sum, liseron d'eau, épinards), ail, huile, sel | sauter très vite au wok à feu vif | midi, soir | vegan |
| Pai huanggua (concombre écrasé) | Chine | concombre, ail, vinaigre noir, sauce soja, huile pimentée ou huile de sésame | écraser le concombre au plat du couteau, assaisonner à cru | midi, soir | vegan |
| Hongshao rou (porc braisé rouge) | Chine (Shanghai, Hunan, Jiangnan) | poitrine de porc, sauce soja, sucre (candi), vin de Shaoxing, gingembre, anis étoilé | caraméliser le sucre, braiser longuement | midi, soir |  |
| Qingzheng yu (poisson entier à la vapeur) | Chine (Canton), Hong Kong | poisson entier (bar, tilapia, dorade), gingembre, ciboule, sauce soja, huile chaude | cuire à la vapeur, arroser d'huile fumante sur la ciboule | midi, soir |  |
| Baiqie ji (poulet poché, sauce gingembre-ciboule) | Chine (Canton), Hong Kong | poulet entier, gingembre, ciboule, sel, huile | pocher à frémissement, plonger dans l'eau glacée, huile chaude sur gingembre et ciboule | midi, soir |  |
| Zhajiang mian (nouilles à la sauce de soja fermenté) | Chine (Pékin, Shandong) | nouilles de blé, porc haché, pâte de soja fermenté (huangjiang, tianmianjiang), concombre en julienne, ciboule | frire la pâte avec la viande, servir sur nouilles avec crudités | midi, soir |  |
| Huoguo (fondue chinoise) | Chine (Sichuan, Chongqing, Pékin), Taïwan | bouillon (pimenté ou clair), viande en tranches fines (bœuf, agneau), tofu, légumes à feuilles, champignons, sauce de trempage (sésame, ail) | cuire à table dans le bouillon frémissant | soir |  |
| Zongzi (riz gluant en feuilles de bambou) | Chine, Taïwan | riz gluant, feuilles de bambou, poitrine de porc marinée (ou jujubes, pâte de haricot rouge), jaune d'œuf salé, sauce soja | envelopper et ficeler, bouillir longuement | midi, encas |  |
| Miso shiru (soupe miso) | Japon | dashi (kombu, bonite séchée), miso, tofu, wakame, ciboule | préparer le dashi, délayer le miso hors ébullition | matin, midi, soir |  |
| Onigiri (boule de riz) | Japon | riz japonais, sel, nori, garniture (umeboshi, saumon grillé émietté, thon-mayonnaise, konbu) | façonner le riz tiède à la main salée | matin, midi, encas |  |
| Tamagoyaki (omelette roulée) | Japon | œufs, dashi, sucre, sauce soja (ou sel) | cuire en couches fines et rouler dans la poêle | matin, midi |  |
| Natto gohan (riz au soja fermenté) | Japon | natto, riz, sauce (soja, dashi), moutarde karashi, ciboule | battre le natto pour le rendre filant, servir sur riz chaud | matin |  |
| Shiozake (saumon salé grillé) | Japon | saumon (ou maquereau, saba), sel, daikon râpé (accompagnement) | saler, griller | matin, soir |  |
| Zōsui (riz cuit en bouillon) | Japon | riz cuit, dashi, œuf, légumes (champignons, carotte, ciboule), sauce soja | mijoter le riz cuit dans le bouillon, lier à l'œuf battu | matin, soir |  |
| Nikujaga (ragoût viande et pommes de terre) | Japon | bœuf ou porc en tranches fines, pommes de terre, oignon, carotte, sauce soja, mirin et sucre, dashi | revenir puis mijoter à couvert | midi, soir |  |
| Karē raisu (curry japonais) | Japon | roux de curry, pommes de terre, carottes, oignons, viande (porc, bœuf, poulet), riz | revenir puis mijoter, lier avec le roux | midi, soir |  |
| Oyakodon (bol de riz poulet et œuf) | Japon | poulet, œufs, oignon, dashi, sauce soja et mirin, riz | mijoter dans le bouillon sucré-salé, verser l'œuf et cuire à peine | midi, soir |  |
| Yakisoba (nouilles sautées) | Japon | nouilles de blé, chou, porc en tranches, carotte et oignon, sauce yakisoba (type Worcestershire) | sauter à la plaque ou à la poêle | midi, encas |  |
| Okonomiyaki (galette au chou) | Japon (Osaka, Hiroshima) | farine, chou émincé, œufs, dashi, poitrine de porc (ou fruits de mer), sauce okonomi et mayonnaise | mélanger la pâte au chou, cuire épais à la plaque | midi, soir |  |
| Tonjiru (soupe miso au porc) | Japon | porc en tranches, daikon, carotte, bardane (gobō), miso, dashi | revenir le porc, mijoter les racines, délayer le miso | matin, midi, soir |  |
| Kinpira gobō (bardane et carotte sautées) | Japon | bardane (gobō), carotte, sauce soja, mirin et sucre, sésame, piment | tailler en julienne, sauter puis glacer | midi, soir | vegan |
| Hōrensō no goma-ae (épinards au sésame) | Japon | épinards, sésame grillé, sauce soja, sucre | blanchir et essorer, assaisonner au sésame pilé | midi, soir | vegan |
| Asazuke (légumes marinés minute) | Japon | légumes (concombre, chou, daikon, navet), sel, kombu, piment | saler et presser quelques heures | matin, midi, soir | vegan |
| Kimchi jjigae (ragoût de kimchi) | Corée | kimchi bien fermenté, porc (ou thon en conserve), tofu, gochugaru, oignon, ciboule | revenir le kimchi avec le porc, mijoter | matin, midi, soir |  |
| Doenjang jjigae (ragoût de pâte de soja) | Corée | doenjang, tofu, courgette, pomme de terre et oignon, piment, bouillon d'anchois séchés | délayer la pâte dans le bouillon, mijoter | matin, midi, soir |  |
| Kimchi bokkeumbap (riz sauté au kimchi) | Corée | riz cuit, kimchi, œuf au plat, oignon, huile de sésame, porc, jambon ou spam (facultatif) | sauter le kimchi puis le riz | midi, soir | végétarien |
| Bibimbap | Corée | riz, namul (légumes assaisonnés), gochujang, œuf, huile de sésame, bœuf haché (facultatif) | préparer chaque légume séparément, mélanger au moment de manger | midi, soir |  |
| Namul (légumes assaisonnés : kongnamul, sigeumchi) | Corée | légume (pousses de soja, épinards, fougère), ail, huile de sésame, sel ou sauce soja, sésame | blanchir, assaisonner à la main | matin, midi, soir | vegan |
| Gyeran jjim (œufs vapeur) | Corée | œufs, eau ou bouillon, ciboule, sel ou crevettes salées (saeujeot) | battre et cuire à la vapeur ou au poêlon | matin, midi, soir |  |
| Miyeokguk (soupe d'algues) | Corée | algue wakame (miyeok), bœuf (ou moules), huile de sésame, ail, sauce soja pour soupe | revenir l'algue et la viande à l'huile de sésame, mijoter | matin, midi, soir |  |
| Pajeon (galette à la ciboule) | Corée | farine, ciboule, œuf, eau, fruits de mer ou kimchi (variantes haemul pajeon, kimchijeon) | poêler une galette fine et croustillante | midi, soir, encas | végétarien |
| Tteokbokki (gâteaux de riz pimentés) | Corée | gâteaux de riz (tteok), gochujang, gochugaru, sucre, galettes de poisson (eomuk), ciboule | mijoter jusqu'à sauce épaisse | encas, midi |  |
| Kimbap (rouleau de riz) | Corée | riz assaisonné à l'huile de sésame, algue gim, carotte, épinards, omelette, radis jaune mariné (danmuji), jambon, surimi ou thon | rouler avec une natte, trancher | midi, encas |  |
| Bulgogi (bœuf mariné) | Corée | bœuf en tranches fines, sauce soja, sucre, poire nashi râpée, ail, huile de sésame | mariner, sauter ou griller | midi, soir |  |
| Japchae (nouilles de patate douce sautées) | Corée | nouilles de patate douce (dangmyeon), épinards, carotte et oignon, champignons, bœuf (facultatif), sauce soja, sucre, huile de sésame | cuire chaque élément séparément, mélanger et assaisonner | midi, soir |  |
| Tteokguk (soupe de gâteaux de riz du Nouvel An) | Corée | tranches de gâteau de riz (tteok), bouillon de bœuf (ou d'anchois), œuf, algue gim, ciboule | mijoter le tteok dans le bouillon, garnir d'œuf en lanières | matin, midi |  |
| Hobakjuk (bouillie de potiron) | Corée | potiron, farine de riz gluant, sucre, sel | cuire et écraser le potiron, lier à la farine de riz | matin, encas | vegan |
| Hotteok (crêpe fourrée au sucre) | Corée | farine, levure, cassonade, cannelle, graines ou noix concassées | pâte levée fourrée, aplatir à la poêle | encas | végétarien |
| Lu rou fan (riz au porc braisé) | Taïwan | poitrine de porc hachée ou en petits dés, sauce soja, échalotes frites, sucre, cinq-épices, riz, œuf dur braisé | braiser longuement | matin, midi, soir |  |
| Fan tuan (boule de riz gluant) | Taïwan, Shanghai | riz gluant, youtiao, porc filoché séché (rousong), légumes marinés, œuf (facultatif) | étaler le riz chaud, garnir et serrer en boule | matin |  |
| Dan bing (crêpe à l'œuf) | Taïwan | pâte à crêpe fine (farine, eau), œuf, ciboule, sauce soja épaisse ou sauce pimentée | cuire la crêpe sur l'œuf, rouler et couper | matin | végétarien |
| Niurou mian (soupe de nouilles au bœuf braisé) | Taïwan | bœuf (jarret), doubanjiang, sauce soja, tomate, gingembre, anis étoilé, nouilles de blé, chou chinois | braiser le bœuf en bouillon épicé, servir sur nouilles | midi, soir |  |
| Buuz (raviolis vapeur) | Mongolie | mouton (ou bœuf) haché, oignon, ail, farine de blé, sel | farcir et plisser en laissant une ouverture, cuire à la vapeur | midi, soir |  |
| Khuushuur (chausson frit) | Mongolie | mouton (ou bœuf) haché, oignon, farine de blé, sel | farcir et aplatir, frire | midi, encas |  |
| Tsuivan (nouilles sautées à l'étuvée) | Mongolie | nouilles maison (farine, eau), mouton ou bœuf, carotte, chou, oignon | revenir la viande et les légumes, étuver les nouilles à couvert dessus | midi, soir |  |

<a id="asie-sud-est"></a>

## Asie du Sud-Est (60 plats)

| Plat | Pays | Ingrédients essentiels | Techniques | Moments | Régime |
|---|---|---|---|---|---|
| Khao tom (soupe de riz) | Thaïlande | riz cuit, bouillon, porc haché ou crevettes, ail frit, gingembre, coriandre et ciboule | réchauffer le riz cuit dans le bouillon, garnir d'ail frit | matin, soir |  |
| Pa thong ko (beignets) | Thaïlande | farine de blé, levure ou bicarbonate, sucre, sel, huile de friture | laisser reposer la pâte, frire | matin, encas | vegan |
| Moo ping et khao niao (brochettes de porc et riz gluant) | Thaïlande | porc, lait de coco, ail, coriandre (racine) et poivre, sauce poisson et sucre de palme, riz gluant | mariner, griller au charbon | matin, encas |  |
| Khai jiao (omelette thaïe) | Thaïlande | œufs, sauce poisson, huile abondante, riz, porc haché (facultatif) | frire l'omelette battue dans l'huile très chaude | matin, midi, soir |  |
| Pad kra pao (sauté au basilic sacré) | Thaïlande | porc ou poulet haché, basilic sacré (ou basilic thaï), ail et piment, sauce d'huître, sauce soja, sauce poisson, riz, œuf au plat | piler ail et piment, sauter à feu vif | midi, soir |  |
| Pad thai | Thaïlande | nouilles de riz plates, tamarin, sauce poisson et sucre de palme, œuf, tofu ferme et crevettes, pousses de soja et ciboule chinoise, cacahuètes | réhydrater les nouilles, sauter au wok | midi, soir |  |
| Tom yam (soupe aigre-piquante) | Thaïlande | crevettes (ou poulet, poisson), citronnelle, galanga, feuilles de combava, citron vert et sauce poisson, piment, champignons | infuser les aromates dans le bouillon, assaisonner hors du feu | midi, soir |  |
| Kaeng khiao wan (curry vert) | Thaïlande | pâte de curry vert, lait de coco, poulet (ou bœuf, boulettes de poisson), aubergines thaïes, basilic thaï, sauce poisson et sucre de palme | frire la pâte de curry dans la crème de coco, mijoter | midi, soir |  |
| Som tam (salade de papaye verte) | Thaïlande, Laos (tam mak hoong) | papaye verte râpée, piment et ail, citron vert, sauce poisson (ou padaek au Laos), tomates et haricots kilomètre, crevettes séchées et cacahuètes | piler au mortier | midi, soir, encas |  |
| Larb (salade de viande hachée) | Laos, Thaïlande (Isan) | viande hachée (porc, poulet, bœuf) ou poisson, riz gluant grillé moulu, citron vert, sauce poisson, échalotes, menthe et coriandre | cuire la viande à sec, assaisonner tiède | midi, soir |  |
| Khao niao (riz gluant) | Laos, Thaïlande (Nord et Isan) | riz gluant, eau, accompagnements (larb, som tam, jaew, grillades) | tremper une nuit, cuire à la vapeur dans un panier | matin, midi, soir | vegan |
| Khao piak sen (soupe de nouilles) | Laos | nouilles fraîches de riz et tapioca, bouillon de poulet, poulet, ail frit, ciboule et coriandre | cuire les nouilles dans le bouillon pour l'épaissir | matin, midi |  |
| Phở | Vietnam | bouillon de bœuf (ou poulet : phở gà), nouilles de riz plates, gingembre et oignon grillés, anis étoilé, cannelle, cardamome noire, bœuf en tranches fines, herbes (basilic thaï, coriandre, ciboule) | griller les aromates, mijoter longuement les os | matin, midi |  |
| Bánh mì | Vietnam | baguette légère, viande (porc grillé, charcuterie, pâté) ou œuf, carotte et radis marinés, concombre, coriandre et piment, sauce soja ou mayonnaise | garnir un pain chaud | matin, encas |  |
| Xôi (riz gluant salé ou sucré) | Vietnam | riz gluant, haricots mungo, arachides ou maïs, échalotes frites, garniture (porc, œuf, saucisse) ou noix de coco et sucre | tremper, cuire à la vapeur | matin, encas |  |
| Bánh cuốn (crêpes de riz vapeur farcies) | Vietnam (Nord) | pâte de farine de riz, porc haché, champignons noirs, échalotes frites, nước chấm (sauce au nước mắm) | cuire une crêpe fine à la vapeur, farcir et rouler | matin |  |
| Cháo gà (bouillie de riz au poulet) | Vietnam | riz, poulet, gingembre, échalotes, ciboule, nước mắm | pocher le poulet, cuire le riz dans le bouillon | matin, soir |  |
| Cơm tấm (riz brisé au porc grillé) | Vietnam (Sud) | riz brisé, côtelette de porc marinée (citronnelle, nước mắm, sucre), œuf au plat ou flan d'œuf, légumes marinés, huile à la ciboule, nước chấm | mariner, griller | matin, midi, soir |  |
| Bún chả (porc grillé et vermicelles) | Vietnam (Hanoï) | porc haché et poitrine, vermicelles de riz, nước chấm dilué, papaye verte ou carotte marinée, herbes fraîches, ail et sucre | mariner, griller au charbon, servir dans la sauce tiède | midi |  |
| Gỏi cuốn (rouleaux de printemps) | Vietnam | galettes de riz, vermicelles de riz, crevettes et porc bouilli, salade et herbes, sauce hoisin-arachide ou nước chấm | humidifier la galette, rouler à cru | midi, encas |  |
| Chả giò / Nem rán (rouleaux frits) | Vietnam | galettes de riz, porc haché, champignons noirs et vermicelles, carotte, taro ou chou-rave, œuf, nước chấm | rouler serré, frire | midi, soir |  |
| Canh chua (soupe aigre au poisson) | Vietnam (Sud) | poisson (poisson-chat) ou crevettes, tamarin, tomate et ananas, pousses de soja, tige de taro (bạc hà) ou gombo, herbes (rau om, ngò gai) | acidifier le bouillon au tamarin, cuire le poisson brièvement | midi, soir |  |
| Cá kho tộ (poisson caramélisé) | Vietnam | poisson (poisson-chat, maquereau), caramel, nước mắm, échalotes et ail, poivre noir, piment | braiser en pot de terre jusqu'à sauce sirupeuse | midi, soir |  |
| Thịt kho trứng (porc et œufs caramélisés) | Vietnam (Sud) | poitrine de porc, œufs durs, eau de coco, nước mắm, caramel ou sucre, échalotes et ail | braiser longuement | midi, soir |  |
| Rau muống xào tỏi (liseron d'eau sauté à l'ail) | Vietnam | liseron d'eau, ail, huile, nước mắm ou sel | blanchir rapidement, sauter à feu vif | midi, soir |  |
| Đậu hũ sốt cà chua (tofu à la sauce tomate) | Vietnam | tofu ferme, tomates, ciboule, échalote, nước mắm ou sauce soja | frire le tofu, mijoter dans la sauce tomate | midi, soir |  |
| Bánh xèo (crêpe croustillante) | Vietnam (Sud et Centre) | farine de riz, curcuma, lait de coco, crevettes et porc, pousses de soja, salade et herbes | cuire une crêpe fine et croustillante, envelopper dans la salade | midi, soir, encas |  |
| Bai sach chrouk (porc grillé et riz) | Cambodge | porc mariné (ail, lait de coco, sauce soja), riz, légumes marinés, bouillon clair | mariner, griller au charbon | matin |  |
| Kuy teav (soupe de nouilles au porc) | Cambodge | nouilles de riz, bouillon d'os de porc, porc (tranches, haché, abats) ou crevettes, ail frit, pousses de soja et herbes, citron vert | mijoter le bouillon, blanchir nouilles et viande | matin |  |
| Amok trey (poisson au kroeung et coco) | Cambodge | poisson, kroeung (citronnelle, galanga, curcuma, combava), lait de coco, œuf, feuilles de noni ou épinards, sauce poisson | piler le kroeung, cuire à la vapeur en coupelle de feuille de bananier | midi, soir |  |
| Samlor korko (soupe de légumes au kroeung) | Cambodge | kroeung, prahok (pâte de poisson fermenté), riz grillé moulu, légumes variés (courge, aubergine, papaye verte, haricots), poisson ou porc | revenir le kroeung, mijoter les légumes | midi, soir |  |
| Mohinga (soupe de poisson aux vermicelles) | Birmanie | poisson (poisson-chat), farine de riz grillée ou pois chiches, citronnelle, cœur de bananier, vermicelles de riz, œuf dur et beignets | mijoter le poisson avec les aromates, épaissir à la farine grillée | matin |  |
| Lahpet thoke (salade de feuilles de thé fermentées) | Birmanie | feuilles de thé fermentées (lahpet), chou ou tomate, fèves, cacahuètes et sésame frits, ail frit, crevettes séchées, citron vert | mélanger à la main | encas, midi |  |
| Ohn no khao swè (nouilles au coco et poulet) | Birmanie | nouilles de blé, poulet, lait de coco, farine de pois chiches, oignon, ail, gingembre, curcuma et paprika | mijoter un bouillon coco épaissi | matin, midi |  |
| Si byan (curry birman à l'huile) | Birmanie | poulet, porc ou poisson, oignons en grande quantité, ail et gingembre, curcuma et paprika, huile, sauce poisson ou ngapi | mijoter jusqu'à ce que l'huile se sépare | midi, soir |  |
| Nasi lemak (riz au lait de coco) | Malaisie, Singapour, Brunei | riz cuit au lait de coco et pandan, sambal, anchois frits (ikan bilis), cacahuètes grillées, œuf dur ou au plat, concombre | cuire le riz au coco, frire les garnitures | matin, midi |  |
| Roti canai (galette feuilletée) | Malaisie, Singapour (roti prata) | farine, ghee ou huile, eau, sel, dal ou curry pour tremper | étirer la pâte très finement, plier et cuire à la plaque | matin, encas | végétarien |
| Kaya toast et œufs mollets | Singapour, Malaisie | pain de mie grillé, kaya (confiture coco-œuf-pandan), beurre, œufs mollets, sauce soja et poivre blanc | griller le pain, cuire les œufs à peine pris | matin, encas | végétarien |
| Nasi ayam (riz au poulet hainanais) | Singapour, Malaisie | poulet entier, riz cuit dans le bouillon et la graisse de poulet, gingembre et ail, pandan, sauce piment-gingembre, concombre | pocher le poulet, cuire le riz avec le bouillon | midi, soir |  |
| Char kway teow (nouilles de riz sautées) | Malaisie, Singapour | nouilles de riz plates, crevettes ou coques, saucisse chinoise, œuf, pousses de soja et ciboule chinoise, sauce soja sucrée et claire | sauter au wok à très feu vif | midi, soir |  |
| Laksa (curry laksa) | Malaisie, Singapour | pâte de laksa (piment, citronnelle, galanga, crevettes séchées), lait de coco, nouilles (vermicelles de riz, nouilles jaunes), tofu frit, crevettes ou poulet, pousses de soja | frire la pâte d'épices, mijoter le bouillon coco | matin, midi |  |
| Nasi goreng (riz sauté) | Indonésie, Malaisie | riz cuit de la veille, kecap manis, échalotes et ail, piment ou sambal, œuf au plat, terasi (pâte de crevettes) | piler les aromates, sauter au wok | matin, midi, soir |  |
| Bubur ayam (bouillie de riz au poulet) | Indonésie | riz, poulet effiloché, bouillon jaune ou sauce soja, échalotes frites, ciboule et céleri, krupuk et cakwe (beignet) | cuire le riz en bouillie, garnir | matin |  |
| Gado-gado (légumes sauce cacahuète) | Indonésie | légumes blanchis (chou, haricots verts, épinards, pousses de soja), pommes de terre, tofu et tempeh, œuf dur, sauce cacahuète, kerupuk | blanchir les légumes, napper de sauce cacahuète pilée | midi, encas | végétarien |
| Tempe goreng (tempeh frit) | Indonésie | tempeh, ail, coriandre en grains, sel, huile | mariner dans l'eau d'ail salée, frire | midi, soir, encas | vegan |
| Sayur asem (soupe aigre de légumes) | Indonésie (Java) | tamarin, maïs, chayote ou chou, haricots kilomètre, feuilles et graines de melinjo, arachides | mijoter les légumes dans un bouillon aigre | midi, soir | vegan |
| Sayur lodeh (légumes au lait de coco) | Indonésie (Java) | lait de coco, légumes (chayote, haricots kilomètre, aubergine, jacquier vert), tofu ou tempeh, échalotes, ail, galanga, feuilles de salam | mijoter doucement dans le coco | midi, soir |  |
| Soto ayam (soupe de poulet au curcuma) | Indonésie | poulet, curcuma, citronnelle et galanga, vermicelles de riz, œuf dur, chou et pousses de soja | mijoter le poulet dans un bouillon épicé, effilocher | matin, midi |  |
| Sate ayam (brochettes sauce cacahuète) | Indonésie, Malaisie | poulet en dés, kecap manis, ail et échalotes, sauce cacahuète, lontong (riz compressé) | mariner, griller au charbon | soir, encas |  |
| Rendang (bœuf mijoté au coco) | Indonésie (Minangkabau), Malaisie | bœuf, lait de coco, piments, échalotes, ail, gingembre, galanga, citronnelle, feuilles de curcuma et de combava, noix de coco grillée (kerisik) | mijoter très longuement jusqu'à réduction complète | midi, soir |  |
| Pisang goreng (bananes frites) | Indonésie, Malaisie | bananes plantain ou bananes mûres, farine de riz ou de blé, eau, sucre et sel | enrober de pâte, frire | encas, matin | vegan |
| Adobo (poulet ou porc au vinaigre et soja) | Philippines | poulet ou porc, vinaigre, sauce soja, ail, laurier, poivre noir en grains | mariner, mijoter puis réduire | midi, soir |  |
| Sinigang (soupe aigre) | Philippines | porc, crevettes ou poisson, tamarin, tomate et oignon, radis, liseron d'eau, haricots kilomètre, aubergine ou gombo, sauce poisson | acidifier le bouillon au tamarin, mijoter | midi, soir |  |
| Silog (petit-déjeuner riz à l'ail et œuf : tapsilog, longsilog) | Philippines | riz sauté à l'ail (sinangag), œuf au plat, viande (tapa de bœuf, longganisa, tocino), vinaigre pour tremper | sauter le riz de la veille à l'ail, frire l'œuf | matin |  |
| Arroz caldo / Lugaw (bouillie de riz au gingembre) | Philippines | riz (gluant ou non), poulet, gingembre, ail frit, sauce poisson, œuf dur | revenir ail et gingembre, cuire le riz en bouillie | matin, encas |  |
| Champorado (bouillie de riz au chocolat) | Philippines | riz gluant, chocolat (tablea), sucre, lait concentré | cuire le riz avec le chocolat | matin, encas | végétarien |
| Pancit (bihon, canton) | Philippines | nouilles (de riz ou de blé), poulet ou porc, chou et carotte, haricots verts, sauce soja, citron calamansi | sauter les légumes et la viande, cuire les nouilles dans le bouillon | midi, soir, encas |  |
| Ginisang monggo (haricots mungo mijotés) | Philippines | haricots mungo, ail, oignon, tomate, feuilles vertes (moringa, feuilles de margose, épinards), porc ou crevettes séchées, sauce poisson | cuire les haricots, faire revenir les aromates et mijoter | midi, soir |  |
| Pinakbet (légumes mijotés à la pâte de crevettes) | Philippines (Ilocos) | courge, aubergine, margose, gombo et haricots kilomètre, bagoong (pâte de crevettes ou de poisson), porc (facultatif) | mijoter à l'étouffée | midi, soir |  |
| Turon (rouleau de banane caramélisé) | Philippines | banane saba, feuilles de lumpia, sucre roux, jacquier (facultatif) | rouler, frire en caramélisant le sucre | encas | vegan |

<a id="asie-sud"></a>

## Asie du Sud (60 plats)

| Plat | Pays | Ingrédients essentiels | Techniques | Moments | Régime |
|---|---|---|---|---|---|
| Aloo paratha (galette farcie aux pommes de terre) | Inde du Nord (Pendjab), Pakistan | farine de blé complet (atta), pommes de terre, piment vert et coriandre, cumin ou amchur, ghee ou beurre, yaourt pour accompagner | farcir et étaler la pâte, cuire au tawa avec du ghee | matin | végétarien |
| Poha (riz aplati aux épices) | Inde (Maharashtra, Madhya Pradesh) | riz aplati (poha), oignon, pomme de terre ou petits pois, graines de moutarde et feuilles de curry, curcuma, cacahuètes, citron et coriandre | rincer le poha, tempérer les épices et mélanger | matin, encas | vegan |
| Upma (semoule aux épices) | Inde du Sud | semoule de blé (rava), oignon, graines de moutarde, urad dal et feuilles de curry, piment vert et gingembre, légumes (carotte, petits pois), ghee ou huile | griller la semoule, tempérer les épices, cuire à l'eau bouillante | matin, encas | végétarien |
| Idli (gâteaux de riz vapeur) | Inde du Sud, Sri Lanka | riz, urad dal, sel, chutney de coco et sambar | tremper, moudre et fermenter la pâte, cuire à la vapeur | matin, soir | vegan |
| Dosa (crêpe fermentée) | Inde du Sud | riz, urad dal, sel, garniture de pommes de terre épicées (masala dosa), chutney de coco et sambar | fermenter la pâte, étaler finement sur plaque chaude | matin, soir | vegan |
| Uttapam (galette épaisse aux légumes) | Inde du Sud | pâte à dosa ou idli, oignon, tomate, piment vert, coriandre | cuire une galette épaisse garnie sur plaque | matin, soir | vegan |
| Ven pongal (riz et lentilles au poivre) | Inde du Sud (Tamil Nadu) | riz, moong dal, poivre noir et cumin, gingembre et feuilles de curry, ghee, noix de cajou | cuire riz et lentilles ensemble, tempérer au ghee | matin | végétarien |
| Medu vada (beignet de lentilles) | Inde du Sud, Sri Lanka | urad dal, piment vert, gingembre, feuilles de curry, poivre noir | mixer en pâte aérée, former un anneau et frire | matin, encas | vegan |
| Sambar (lentilles aux légumes et tamarin) | Inde du Sud, Sri Lanka | toor dal, tamarin, poudre de sambar, légumes (drumstick, aubergine, courge, oignon), graines de moutarde et feuilles de curry | cuire les lentilles, mijoter avec légumes et tamarin, tempérer | matin, midi, soir | vegan |
| Rasam (bouillon poivré au tamarin) | Inde du Sud | tamarin, tomate, poivre noir et cumin, ail, toor dal (eau de cuisson), graines de moutarde et feuilles de curry | piler les épices, frémir sans bouillir longtemps, tempérer | midi, soir | vegan |
| Thoran / Poriyal (légumes sautés à la noix de coco) | Inde du Sud (Kerala, Tamil Nadu) | légume finement coupé (chou, haricots verts, carotte, betterave), noix de coco râpée, graines de moutarde, feuilles de curry, piment vert, curcuma | tempérer les graines, sauter à couvert, finir à la noix de coco | midi, soir | vegan |
| Avial (légumes à la noix de coco et au yaourt) | Inde du Sud (Kerala) | légumes mélangés (banane plantain, courge, drumstick, carotte, haricots), noix de coco, cumin et piment vert, yaourt, huile de coco et feuilles de curry | cuire les légumes en bâtonnets, lier à la pâte de coco | midi | végétarien |
| Meen curry (curry de poisson) | Inde du Sud (Kerala), Sri Lanka | poisson, tamarin malabar (kudampuli) ou tamarin, piment et curcuma, lait de coco (selon la région), gingembre, ail, échalotes, feuilles de curry | mijoter dans la sauce acide | midi, soir |  |
| Curd rice (riz au yaourt) | Inde du Sud | riz cuit, yaourt, graines de moutarde et urad dal, feuilles de curry, piment vert et gingembre | écraser le riz avec le yaourt, tempérer | midi, soir | végétarien |
| Dal tadka (lentilles tempérées) | Inde du Nord | lentilles (toor dal, masoor dal ou moong dal), curcuma, tomate et oignon, ail, cumin, ghee | cuire les lentilles, verser un tadka d'épices frites au ghee | midi, soir | végétarien |
| Rajma chawal (haricots rouges et riz) | Inde du Nord (Pendjab, Jammu) | haricots rouges, oignon, tomate, gingembre et ail, garam masala et cumin, riz | tremper et cuire les haricots, mijoter dans le masala | midi, soir | vegan |
| Chole (pois chiches épicés) | Inde du Nord, Pakistan | pois chiches, oignon et tomate, gingembre et ail, chana masala (coriandre, cumin, amchur), thé noir pour la couleur (facultatif) | cuire les pois chiches, mijoter dans le masala | matin, midi, soir | vegan |
| Puri bhaji / Halwa puri (pains frits et accompagnement) | Inde du Nord, Pakistan | farine de blé complet, huile de friture, pommes de terre épicées (aloo bhaji) ou chole, halwa de semoule (version pakistanaise) | étaler de petits disques, frire jusqu'à ce qu'ils gonflent | matin | végétarien |
| Aloo gobi (pommes de terre et chou-fleur) | Inde du Nord, Pakistan | pommes de terre, chou-fleur, oignon et tomate, curcuma et cumin, gingembre, coriandre | sauter puis cuire à couvert | midi, soir | vegan |
| Bhindi masala (gombos sautés) | Inde, Pakistan | gombos, oignon, tomate, curcuma et poudre de coriandre, amchur ou citron | sauter à découvert pour éviter le gluant | midi, soir | vegan |
| Baingan bharta (aubergine fumée écrasée) | Inde du Nord, Pakistan (baingan ka bharta) | aubergine, oignon, tomate, ail et piment vert, coriandre | griller l'aubergine sur la flamme, écraser et sauter avec le masala | midi, soir | vegan |
| Palak paneer (épinards au fromage frais) | Inde du Nord | épinards, paneer, oignon et tomate, gingembre et ail, garam masala, crème (facultatif) | blanchir et mixer les épinards, mijoter avec le paneer | midi, soir | végétarien |
| Kadhi pakora (sauce au yaourt et beignets) | Inde du Nord (Pendjab, Rajasthan, Gujarat) | yaourt, farine de pois chiche (besan), curcuma, oignon, graines de fenugrec, cumin et moutarde | fouetter yaourt et besan, mijoter longuement, ajouter des pakoras frits | midi, soir | végétarien |
| Sarson ka saag et makki di roti (feuilles de moutarde et galette de maïs) | Inde du Nord (Pendjab), Pakistan (Pendjab) | feuilles de moutarde, épinards ou bathua, farine de maïs, gingembre, ail, piment vert, ghee ou beurre | cuire longuement et écraser les feuilles, cuire les galettes au tawa | midi, soir | végétarien |
| Khichdi / Khichuri (riz et lentilles) | Inde, Bangladesh, Pakistan, Népal | riz, lentilles (moong dal, masoor dal), curcuma, cumin, ghee, légumes (facultatif) | cuire riz et lentilles ensemble, tempérer au ghee | midi, soir | végétarien |
| Pulao (riz parfumé aux légumes) | Inde, Pakistan, Bangladesh | riz basmati, légumes (petits pois, carotte) ou viande, oignon, épices entières (cardamome, clou de girofle, cannelle, laurier), ghee ou huile | frire les épices entières, cuire le riz par absorption | midi, soir |  |
| Biryani | Inde (Hyderabad, Lucknow, Kolkata), Pakistan (Sindh), Bangladesh | riz basmati, viande (poulet, mouton) marinée au yaourt, oignons frits, épices entières et garam masala, safran ou lait, menthe et coriandre | mariner, précuire le riz, superposer et cuire à l'étouffée (dum) | midi, soir |  |
| Murgh curry (curry de poulet maison) | Inde, Pakistan, Bangladesh | poulet, oignon, tomate, gingembre et ail, curcuma, piment, coriandre, garam masala, yaourt (facultatif) | revenir longuement l'oignon (bhuna), mijoter | midi, soir |  |
| Chicken karahi (poulet sauté au karahi) | Pakistan, Inde du Nord | poulet, tomates, gingembre et ail, piment vert, poivre noir et coriandre concassée, huile ou ghee | cuire à feu vif dans le karahi jusqu'à réduction de la tomate | midi, soir |  |
| Aloo keema (viande hachée aux pommes de terre) | Pakistan, Inde du Nord | viande hachée (bœuf, mouton), pommes de terre ou petits pois, oignon et tomate, gingembre et ail, garam masala | revenir le masala, cuire la viande jusqu'à évaporation | midi, soir |  |
| Nihari (ragoût de bœuf mijoté) | Pakistan, Inde (Delhi, Lucknow) | jarret de bœuf ou de mouton, farine de blé (pour lier), mélange d'épices nihari, oignon frit, gingembre et citron pour garnir | mijoter toute la nuit, lier à la farine | matin, midi |  |
| Haleem (ragoût de céréales, lentilles et viande) | Pakistan, Inde (Hyderabad), Bangladesh | blé concassé ou orge, lentilles mélangées, viande (bœuf, mouton, poulet), oignons frits, gingembre, ail, garam masala | mijoter très longuement, battre jusqu'à texture lisse et filante | midi, soir |  |
| Rogan josh (agneau au piment du Cachemire) | Inde (Cachemire) | agneau ou mouton, yaourt, piment du Cachemire, fenouil et gingembre en poudre, cardamome et clou de girofle | saisir la viande, mijoter longuement | midi, soir |  |
| Anda bhurji (œufs brouillés épicés) | Inde, Pakistan (anda khagina) | œufs, oignon, tomate, piment vert, curcuma, coriandre | revenir le masala, brouiller les œufs | matin, soir | végétarien |
| Anda curry (curry d'œufs durs) | Inde, Pakistan, Bangladesh (dimer jhol) | œufs durs, oignon, tomate, gingembre et ail, curcuma, piment, garam masala | dorer les œufs durs, mijoter dans la sauce | midi, soir | végétarien |
| Thepla (galette au fenugrec) | Inde (Gujarat) | farine de blé complet, feuilles de fenugrec (methi), yaourt, curcuma et piment, huile | pétrir une pâte souple, cuire au tawa | matin, encas | végétarien |
| Dhokla (gâteau vapeur de pois chiche) | Inde (Gujarat) | farine de pois chiche (besan), yaourt ou citron, gingembre et piment vert, bicarbonate (eno), graines de moutarde et feuilles de curry | cuire à la vapeur, arroser d'un tadka | matin, encas | végétarien |
| Samosa (chausson frit) | Inde, Pakistan, Bangladesh (singara), Népal | farine de blé, pommes de terre, petits pois, cumin, coriandre et garam masala, piment vert, huile de friture | façonner en cône, frire à feu moyen | encas | vegan |
| Pakora / Bhaji (beignets de légumes) | Inde, Pakistan, Bangladesh, Népal | farine de pois chiche (besan), légumes (oignon, pomme de terre, épinards, piment), cumin ou ajwain, piment, huile de friture | enrober de pâte épaisse, frire | encas | vegan |
| Pav bhaji (purée de légumes épicée et petits pains) | Inde (Mumbai, Maharashtra) | pommes de terre, légumes (chou-fleur, petits pois, poivron, tomate), pav bhaji masala, beurre, petits pains (pav), oignon et citron | écraser les légumes sur la plaque avec le beurre, griller les pains | encas, soir | végétarien |
| Vada pav (beignet de pomme de terre en petit pain) | Inde (Mumbai) | pommes de terre épicées, farine de pois chiche (besan), petits pains (pav), chutney vert et chutney d'ail sec | façonner des boulettes, enrober et frire | encas, matin | vegan |
| Bhel puri / Chana chaat (en-cas croquant ou aux pois chiches) | Inde, Pakistan | riz soufflé ou pois chiches cuits, oignon et tomate, pomme de terre cuite, chutney de tamarin et chutney vert, chaat masala, coriandre | assembler à la minute | encas | vegan |
| Maacher jhol (curry léger de poisson) | Bangladesh, Inde (Bengale-Occidental) | poisson (rohu, carpe), pommes de terre, curcuma, huile de moutarde, cumin et piment vert, panch phoron | frire le poisson curcumé, mijoter dans un bouillon léger | midi, soir |  |
| Shorshe ilish (alose à la moutarde) | Bangladesh, Inde (Bengale-Occidental) | alose (ilish) ou autre poisson, graines de moutarde moulues, huile de moutarde, piment vert, curcuma | napper de pâte de moutarde, cuire à la vapeur ou mijoter | midi, soir |  |
| Bhorta (purée relevée : aloo, begun, shutki) | Bangladesh, Inde (Bengale) | pomme de terre, aubergine grillée ou poisson séché, huile de moutarde, oignon cru, piment (vert ou sec grillé), coriandre | cuire ou griller, écraser à la main avec les condiments | midi, soir | vegan |
| Masoor dal (lentilles corail) | Bangladesh, Inde, Pakistan | lentilles corail, curcuma, oignon, ail, piment vert ou sec, cumin | cuire les lentilles fluides, tempérer à l'huile | midi, soir | vegan |
| Panta bhat (riz fermenté dans l'eau) | Bangladesh, Inde (Bengale, Odisha : pakhala) | riz cuit de la veille, eau, sel, oignon et piment vert, bhorta ou poisson frit en accompagnement | laisser tremper le riz cuit une nuit | matin, midi | vegan |
| Dal bhat (riz, lentilles et accompagnements) | Népal | riz, lentilles (dal), légumes de saison (tarkari), achar (condiment), épinards ou feuilles sautées (saag) | cuire le dal et tempérer, servir en assiette composée | midi, soir | vegan |
| Momo (raviolis) | Népal, Tibet, Inde (Himalaya) | farine de blé, viande hachée (buffle, poulet, porc) ou légumes, oignon, gingembre et ail, achar de tomate et sésame | farcir et plisser, cuire à la vapeur | encas, midi, soir |  |
| Aloo tama (pommes de terre et pousses de bambou) | Népal | pousses de bambou fermentées (tama), pommes de terre, haricots à œil noir, tomate, curcuma et cumin | mijoter | midi, soir | vegan |
| Gundruk ko jhol (soupe de feuilles fermentées) | Népal | gundruk (feuilles de moutarde ou de radis fermentées séchées), tomate, oignon et ail, piment, soja grillé (facultatif) | réhydrater le gundruk, mijoter en soupe | midi, soir | vegan |
| Sel roti (anneau de riz frit) | Népal | farine de riz, sucre, ghee ou beurre, banane (facultatif), huile de friture | verser la pâte en anneau, frire | matin, encas | végétarien |
| Kiribath (riz au lait de coco) | Sri Lanka | riz, lait de coco, sel, lunu miris (oignon et piment pilés) | cuire le riz puis ajouter le lait de coco, étaler et couper en losanges | matin | vegan |
| Appa (hoppers, crêpes en bol) | Sri Lanka, Inde du Sud (appam) | farine de riz, lait de coco, levure ou toddy, sucre, œuf (version egg hopper) | fermenter la pâte, cuire en faisant tourner dans une petite poêle bombée | matin, soir | vegan |
| Indiappa (string hoppers, nids de vermicelles vapeur) | Sri Lanka, Inde du Sud (idiyappam) | farine de riz, eau chaude, sel, kiri hodi (sauce au lait de coco) ou curry | presser la pâte en vermicelles, cuire à la vapeur | matin, soir | vegan |
| Parippu (curry de lentilles au coco) | Sri Lanka | lentilles corail, lait de coco, curcuma, oignon et ail, piment vert, feuilles de curry et graines de moutarde | cuire les lentilles, finir au lait de coco et tempérer | matin, midi, soir | vegan |
| Pol sambol (condiment de noix de coco) | Sri Lanka | noix de coco râpée, piment en poudre ou flocons, oignon rouge, citron vert, sel, poisson séché de Maldive (facultatif) | piler et mélanger à la main | matin, midi, soir |  |
| Gotu kola sambol (salade de centella) | Sri Lanka | feuilles de centella (gotu kola), noix de coco râpée, échalotes, piment vert, citron vert | émincer très finement, mélanger à cru | midi, soir | vegan |
| Kottu roti (galette hachée sautée) | Sri Lanka | godamba roti (galette) en lanières, légumes (chou, carotte, poireau, oignon), œuf, poulet ou bœuf (facultatif), sauce de curry | hacher et sauter sur plaque avec deux lames | soir, encas |  |
| Ambul thiyal (thon aigre aux épices) | Sri Lanka (Sud) | thon, goraka (tamarin malabar), poivre noir, ail et gingembre, cannelle et feuilles de curry | enrober d'épices, cuire à sec à feu doux jusqu'à réduction | midi, soir |  |

<a id="mexique-amerique-centrale"></a>

## Mexique et Amérique centrale (60 plats)

| Plat | Pays | Ingrédients essentiels | Techniques | Moments | Régime |
|---|---|---|---|---|---|
| Chilaquiles | Mexique | tortillas de maïs rassises, salsa verde (tomatille) ou salsa roja (tomate, piment), crème, fromage frais, oignon, œuf ou poulet effiloché (facultatif) | frire les tortillas en triangles, les enrober de salsa chaude | matin, midi | végétarien |
| Huevos rancheros | Mexique | œufs, tortillas de maïs, sauce tomate au piment, haricots refrits (facultatif) | frire les œufs au plat, napper de sauce sur la tortilla chaude | matin | végétarien |
| Huevos a la mexicana | Mexique | œufs, tomate, oignon, piment vert (serrano, jalapeño) | revenir tomate, oignon et piment, brouiller les œufs dedans | matin | végétarien |
| Molletes | Mexique | pain (bolillo), haricots refrits, fromage râpé, pico de gallo (tomate, oignon, piment, coriandre) | tartiner le pain ouvert, gratiner au four | matin, soir | végétarien |
| Atole | Mexique, Guatemala, Salvador, Honduras | farine de maïs (masa) ou fécule, lait ou eau, sucre (piloncillo), cannelle, vanille ou fruit (facultatif) | délayer la farine, cuire en remuant jusqu'à épaississement | matin, encas | végétarien |
| Champurrado | Mexique | masa de maïs, chocolat, lait ou eau, piloncillo (sucre brun), cannelle | délayer la masa, cuire avec le chocolat en fouettant | matin, encas | végétarien |
| Tamales | Mexique, Amérique centrale | masa de maïs, saindoux (ou huile), farce (poulet ou porc en salsa, fromage et piment), feuilles de maïs ou de bananier | battre la masa avec la graisse, envelopper la farce, cuire à la vapeur | matin, soir |  |
| Frijoles de la olla | Mexique | haricots noirs ou pinto secs, oignon, ail, épazote (facultatif) | cuire longuement les haricots à petit feu dans leur bouillon | midi, soir | vegan |
| Frijoles refritos | Mexique, Amérique centrale | haricots cuits (noirs ou pinto), saindoux ou huile, oignon | revenir l'oignon, écraser les haricots à la poêle jusqu'à purée épaisse | matin, midi, soir |  |
| Arroz rojo (arroz a la mexicana) | Mexique | riz, tomate, oignon, ail, bouillon, petits légumes (carotte, petits pois) | faire dorer le riz cru à l'huile, cuire dans le bouillon tomaté mixé | midi, soir |  |
| Sopa de fideo | Mexique | vermicelles, tomate, oignon, ail, bouillon de poulet (ou eau) | dorer les vermicelles à l'huile, cuire dans le bouillon tomaté | midi |  |
| Sopa de tortilla | Mexique | tortillas de maïs, tomate, piment séché (pasilla), bouillon de poulet, avocat, fromage frais, crème | frire les tortillas en lanières, mixer et cuire la base tomate-piment, verser le bouillon sur les tortillas | midi, soir |  |
| Caldo de res (mole de olla) | Mexique | bœuf avec os (jarret), maïs en épi, chayote, courgette, carotte, chou ou pomme de terre | cuire la viande longuement, ajouter les légumes par ordre de cuisson | midi |  |
| Pozole | Mexique | maïs nixtamalisé (cacahuazintle), porc ou poulet, piment séché (guajillo) pour le rouge, chou ou laitue émincé, radis, oignon, citron vert | cuire le maïs jusqu'à ce qu'il éclate, mijoter avec la viande, garnir à table de crudités | soir |  |
| Mole poblano | Mexique | piments séchés (ancho, mulato, pasilla), chocolat, graines (sésame, cacahuète, amande), épices (cannelle, clou de girofle), tortilla ou pain rassis, poulet ou dinde | griller et réhydrater les piments, mixer et frire la pâte, mijoter longuement avec le bouillon | midi |  |
| Tinga de pollo | Mexique | poulet effiloché, tomate, oignon émincé, piment chipotle | pocher et effilocher le poulet, mijoter dans la sauce tomate-chipotle | midi, soir |  |
| Picadillo | Mexique, Amérique centrale | viande hachée (bœuf ou porc), tomate, pomme de terre, carotte, oignon | revenir la viande, mijoter avec les légumes en dés | midi, soir |  |
| Enchiladas verdes | Mexique | tortillas de maïs, tomatilles, piment vert, poulet effiloché (ou fromage), crème, fromage frais | passer les tortillas dans l'huile chaude, rouler la farce, napper de sauce verte | midi, soir |  |
| Enfrijoladas | Mexique | tortillas de maïs, haricots noirs mixés en sauce, fromage frais, crème, oignon | tremper les tortillas dans la sauce de haricots, plier et garnir | matin, midi, soir | végétarien |
| Chiles rellenos | Mexique, Guatemala | piments poblanos (au Guatemala : poivrons), fromage ou picadillo, œufs battus en neige, sauce tomate | griller et peler les piments, farcir, enrober d'œuf et frire, servir dans la sauce | midi | végétarien |
| Rajas con crema | Mexique | piments poblanos en lanières, oignon, crème, maïs (facultatif), fromage | griller et peler les piments, mijoter avec la crème | midi, soir | végétarien |
| Calabacitas a la mexicana | Mexique | courgettes, tomate, oignon, maïs, piment vert, fromage frais (facultatif) | sauter les légumes, mijoter brièvement | midi, soir | vegan |
| Nopales con huevo | Mexique | raquettes de cactus (nopales), œufs, tomate, oignon, piment | cuire les nopales en lanières jusqu'à ce que la bave disparaisse, brouiller avec les œufs | matin | végétarien |
| Cochinita pibil | Mexique (Yucatán) | épaule de porc, pâte de rocou (achiote), jus d'orange amère (ou orange et citron vert), feuilles de bananier, oignon rouge mariné | mariner la viande, cuire longuement à l'étouffée en feuille de bananier, effilocher | matin, midi |  |
| Pescado a la veracruzana | Mexique (Veracruz) | filets de poisson blanc, tomate, oignon, olives, câpres, piment (güero ou jalapeño) | préparer une sauce tomate aux olives, cuire le poisson dedans | midi |  |
| Ceviche de pescado (mexicain) | Mexique, Costa Rica, Panama | poisson blanc cru, citron vert, tomate, oignon, coriandre, piment | mariner le poisson en dés dans le citron, mélanger aux légumes crus | midi, encas |  |
| Guacamole | Mexique | avocat mûr, citron vert, oignon, piment vert, coriandre, tomate (facultatif) | écraser l'avocat, mélanger les crudités hachées | encas, midi | vegan |
| Quesadillas | Mexique | tortillas de maïs ou de blé, fromage fondant (Oaxaca), garniture (champignons, fleurs de courgette, pomme de terre, restes) | garnir et plier la tortilla, cuire à sec sur le comal | matin, soir, encas | végétarien |
| Sopes | Mexique | masa de maïs, haricots refrits, garniture (viande, chorizo, pomme de terre), salsa, fromage frais, laitue | façonner des galettes épaisses à rebord, cuire au comal puis frire légèrement, garnir | soir, encas |  |
| Tlacoyos | Mexique (centre) | masa de maïs (souvent bleu), haricots ou fèves ou fromage pour la farce, nopales, salsa, fromage frais | farcir la masa en ovale, cuire au comal | matin, encas | végétarien |
| Tostadas | Mexique, Guatemala | tortillas de maïs frites ou séchées, haricots refrits ou guacamole, garniture (poulet, tinga, légumes), salsa, fromage | frire ou griller la tortilla jusqu'à croustillant, garnir en couches | encas, soir |  |
| Elote / esquites | Mexique | maïs (épi ou grains), mayonnaise ou crème, fromage râpé, piment en poudre, citron vert | bouillir ou griller le maïs, garnir de crème, fromage et piment | encas | végétarien |
| Papas con chorizo | Mexique | pommes de terre, chorizo, oignon | rissoler le chorizo, cuire les pommes de terre en dés dans sa graisse | matin, midi |  |
| Arroz con leche | Mexique, Amérique centrale | riz, lait, sucre, cannelle, zeste de citron (facultatif) | cuire le riz dans l'eau puis dans le lait sucré à feu doux | encas, matin | végétarien |
| Pupusas | Salvador, Honduras | masa de maïs (ou de riz), fromage, haricots refrits, chicharrón (porc haché frit), curtido (chou mariné), sauce tomate | farcir des boules de masa et les aplatir, cuire au comal | soir, matin, encas |  |
| Curtido | Salvador | chou, carotte, oignon, vinaigre, origan | émincer finement, mariner quelques heures au vinaigre | midi, soir | vegan |
| Yuca frita con chicharrón | Salvador, Honduras | manioc, porc frit (chicharrón), curtido ou chou, sauce tomate | cuire puis frire le manioc, servir avec le porc croustillant | encas, midi |  |
| Panes con pollo | Salvador | pain (pan francés), poulet mijoté en sauce tomate épicée, cresson, concombre, radis | mijoter le poulet en sauce, garnir le pain de poulet, sauce et crudités | soir, encas |  |
| Pepián | Guatemala | poulet ou bœuf, tomate et tomatilles, graines de courge et sésame grillées, piments séchés (guaque, pasa), légumes (chayote, pomme de terre, haricots verts) | griller les graines, piments et tomates, mixer en sauce, mijoter avec la viande et les légumes | midi |  |
| Jocón | Guatemala | poulet, tomatilles, coriandre, oignon vert, piment vert, tortilla (pour lier) | mixer une sauce verte, mijoter le poulet dedans | midi |  |
| Hilachas | Guatemala | bœuf effiloché (flanc), tomate, tomatilles, piment séché (guajillo), pomme de terre, carotte | cuire et effilocher la viande, mijoter dans la sauce tomate-piment avec les légumes | midi |  |
| Chuchitos | Guatemala | masa de maïs, sauce tomate (recado), poulet ou porc, feuilles de maïs | garnir la masa de viande et de sauce, envelopper et cuire à la vapeur | encas, soir |  |
| Frijoles volteados | Guatemala | haricots noirs cuits, oignon, huile | mixer les haricots, réduire à la poêle en retournant jusqu'à pâte épaisse | matin, soir | vegan |
| Rellenitos de plátano | Guatemala | bananes plantains mûres, haricots noirs en purée sucrée, chocolat, cannelle, sucre | cuire et écraser les plantains, farcir de haricots sucrés, frire | encas | vegan |
| Baleadas | Honduras | tortillas de blé épaisses, haricots rouges refrits, crème (mantequilla), fromage râpé, œufs ou avocat (facultatif) | cuire la tortilla au comal, garnir et plier | matin, soir, encas | végétarien |
| Sopa de caracol | Honduras (côte caraïbe) | conque (lambi), lait de coco, banane plantain verte, manioc, coriandre longue (culantro) | attendrir la conque, mijoter avec les tubercules dans le lait de coco | midi |  |
| Tapado | Honduras, Guatemala (côte garífuna) | poisson et fruits de mer, lait de coco, banane plantain verte et mûre, manioc, coriandre | mijoter tubercules et plantains dans le lait de coco, ajouter les fruits de mer en fin de cuisson | midi |  |
| Sopa de frijoles | Honduras, Nicaragua, Costa Rica | haricots rouges ou noirs, oignon, poivron, coriandre, œuf dur ou banane plantain (facultatif) | cuire les haricots dans beaucoup de bouillon, assaisonner avec un sofrito | midi, soir | végétarien |
| Gallo pinto | Costa Rica, Nicaragua | riz cuit de la veille, haricots cuits (noirs au Costa Rica, rouges au Nicaragua), oignon, poivron, coriandre, sauce Lizano (Costa Rica) | revenir l'oignon, sauter le riz avec les haricots et un peu de leur bouillon | matin, soir | vegan |
| Casado | Costa Rica | riz blanc, haricots noirs, viande ou poisson (ou œuf), banane plantain mûre frite, salade de chou | assembler plusieurs préparations simples dans une assiette | midi |  |
| Olla de carne | Costa Rica | bœuf avec os, manioc, banane plantain verte, maïs en épi, chayote, carotte et pomme de terre | cuire la viande longuement, ajouter les tubercules et légumes | midi |  |
| Chifrijo | Costa Rica | riz, haricots rouges, chicharrón (porc frit), pico de gallo, chips de tortilla, avocat | monter en couches riz, haricots et porc, garnir de pico de gallo | encas, soir |  |
| Arroz con pollo | Costa Rica, Panama, Amérique centrale | riz, poulet effiloché ou en morceaux, poivron, carotte et petits pois, rocou ou tomate pour la couleur | revenir un sofrito, cuire le riz avec le poulet et son bouillon | midi |  |
| Nacatamal | Nicaragua, Honduras | masa de maïs, porc, riz, pomme de terre, tomate, oignon, poivron, feuilles de bananier | garnir la masa, envelopper en feuille de bananier, cuire longuement à l'eau | matin, soir |  |
| Vigorón | Nicaragua | manioc bouilli, chicharrón (couenne de porc frite), salade de chou au vinaigre, tomate, feuille de bananier | cuire le manioc, dresser avec le chou et le porc | encas, midi |  |
| Indio viejo | Nicaragua | bœuf effiloché, masa de maïs ou tortillas trempées, tomate, oignon et poivron, orange amère, menthe (hierbabuena) | cuire et effilocher la viande, épaissir le bouillon avec la masa | midi |  |
| Sancocho panameño | Panama | poulet, igname (ñame), coriandre longue (culantro), oignon, ail, maïs ou manioc (facultatif) | mijoter le poulet avec l'igname jusqu'à ce que le bouillon épaississe | midi |  |
| Carimañola | Panama | manioc, viande hachée (picadillo), oignon, huile de friture | cuire et écraser le manioc, farcir en fuseau, frire | matin, encas |  |
| Hojaldras | Panama | farine, levure chimique, sel et sucre, huile de friture | étaler une pâte simple, frire jusqu'à gonflement | matin | vegan |
| Plátanos fritos con frijoles y crema | Honduras, Salvador, Guatemala | bananes plantains mûres, haricots refrits, crème, fromage frais, œufs (facultatif) | frire les plantains en tranches, servir avec les haricots et la crème | matin, soir | végétarien |

<a id="caraibes"></a>

## Caraïbes (60 plats)

| Plat | Pays | Ingrédients essentiels | Techniques | Moments | Régime |
|---|---|---|---|---|---|
| Colombo de poulet | Guadeloupe, Martinique, Guyane | poulet (ou cabri, porc), poudre à colombo, oignon et ail, piment, légumes (christophine, aubergine, pomme de terre), citron vert | mariner la viande au citron et aux épices, revenir puis mijoter avec les légumes | midi, soir |  |
| Accras de morue | Guadeloupe, Martinique, Guyane | morue salée, farine, levure ou œuf, cive (oignon pays) et persil, piment, ail | dessaler et émietter la morue, préparer une pâte épaisse, frire par cuillerées | encas |  |
| Chiquetaille de morue | Guadeloupe, Martinique | morue salée, citron vert, oignon ou cive, piment, huile | griller ou pocher la morue, effilocher et assaisonner | matin, encas |  |
| Féroce d'avocat | Martinique, Guadeloupe | avocat, morue salée, farine de manioc, piment, citron vert | griller et effilocher la morue, écraser avec l'avocat et la farine de manioc | matin, encas |  |
| Court-bouillon de poisson | Guadeloupe, Martinique, Guyane | poisson (vivaneau, thazard), tomate, oignon et ail, citron vert, piment, bois d'Inde ou thym | mariner le poisson au citron, mijoter dans une sauce tomate relevée | midi, soir |  |
| Blaff de poisson | Guadeloupe, Martinique | poisson, citron vert, cive et ail, piment, bois d'Inde, thym | mariner au citron, pocher brièvement dans un bouillon aromatique | midi, soir |  |
| Riz et pois rouges | Guadeloupe, Martinique, Guyane | riz, haricots rouges, oignon ou cive, ail, thym, lard ou saindoux (facultatif) | cuire les haricots, cuire le riz dans le bouillon des haricots | midi, soir |  |
| Dombrés aux haricots rouges | Guadeloupe, Martinique | farine, haricots rouges, queue de cochon ou viande salée (ou crevettes), oignon, thym | rouler de petites boulettes de pâte, les cuire dans le ragoût de haricots | midi |  |
| Giraumonade | Guadeloupe, Martinique | giraumon (potiron), oignon ou cive, ail, beurre ou huile, piment | cuire le potiron, écraser en purée assaisonnée | midi, soir | végétarien |
| Migan de fruit à pain | Guadeloupe, Martinique | fruit à pain, viande salée (queue de cochon) ou morue, oignon, thym, piment | cuire le fruit à pain avec la viande, écraser grossièrement dans le bouillon | midi |  |
| Christophines gratinées | Guadeloupe, Martinique | christophines (chayotes), lait ou béchamel, fromage râpé, chapelure, oignon (ou viande hachée) | cuire et évider les christophines, mélanger la chair à la farce, gratiner | midi, soir | végétarien |
| Matété de crabe | Guadeloupe | crabes de terre, riz, oignon et ail, piment, bois d'Inde ou thym | revenir les crabes dans les aromates, cuire le riz dans le bouillon de crabe | midi |  |
| Bokit | Guadeloupe | farine, levure, huile de friture, garniture (morue, poulet, crudités, fromage) | frire la pâte en galette gonflée, l'ouvrir et la garnir | encas, soir |  |
| Soupe z'habitant | Martinique, Guadeloupe | légumes pays (giraumon, chou, carotte, navet), tubercules (igname, patate douce), viande salée ou bœuf, pâtes ou dombrés (facultatif) | mijoter longuement viande et légumes | soir |  |
| Calalou | Guadeloupe, Martinique, Trinité-et-Tobago | feuilles de dachine (ou épinards), gombos, lait de coco (Trinité), viande salée ou crabe, oignon et ail, piment | mijoter feuilles et gombos, mixer ou écraser en soupe épaisse | midi |  |
| Bouillon d'awara | Guyane | pâte d'awara (fruit de palmier), viandes fumées et salées, poulet ou poisson, légumes (concombre, chou, haricots verts, épinards) | mijoter très longuement la pâte d'awara avec viandes et légumes | midi |  |
| Blanc-manger coco | Guadeloupe, Martinique | lait de coco, lait concentré sucré, gélatine ou agar-agar, vanille ou cannelle | chauffer les laits avec le gélifiant, prendre au froid | encas | végétarien |
| Diri ak pwa (riz collé aux haricots) | Haïti | riz, haricots rouges ou noirs, épices (épis : persil, ail, cive, piment), clou de girofle, thym | cuire les haricots, cuire le riz dans le bouillon des haricots avec l'épi | midi, soir | vegan |
| Griot | Haïti | épaule de porc, orange amère (ou citron et orange), épi (ail, persil, cive, piment), thym | mariner, braiser jusqu'à tendreté, frire les morceaux | midi, soir |  |
| Pikliz | Haïti | chou, carotte, oignon, piments (scotch bonnet), vinaigre | émincer finement, mariner plusieurs jours au vinaigre | midi, soir | vegan |
| Bannann peze | Haïti | bananes plantains vertes, huile de friture, sel | frire une première fois, aplatir, refrire jusqu'à croustillant | midi, soir, encas | vegan |
| Soup joumou | Haïti | giraumon (potiron), bœuf, légumes (chou, carotte, pomme de terre, navet), pâtes, épi (ail, persil, cive) | cuire et mixer le potiron, mijoter avec la viande, les légumes et les pâtes | matin, midi |  |
| Legim | Haïti | aubergine, chou, christophine, carotte, épinards ou cresson, bœuf ou crabe (facultatif) | mijoter les légumes avec l'épi, écraser en ragoût épais | midi, soir |  |
| Mayi moulen | Haïti | semoule de maïs, haricots ou sauce pois, épi, lait de coco (facultatif) | cuire la semoule en remuant jusqu'à consistance épaisse | midi, soir | vegan |
| Akra (malanga) | Haïti | malanga (chou caraïbe) râpé, épi (ail, persil, cive), piment, huile de friture | râper le malanga, assaisonner, frire par cuillerées | encas | vegan |
| Labouyi bannann | Haïti | banane plantain verte râpée ou farine de plantain, lait (concentré ou de coco), sucre, cannelle, badiane | délayer, cuire en remuant jusqu'à épaississement | matin | végétarien |
| Espageti (spaghetti du matin) | Haïti | spaghetti, saucisses (hot-dogs) ou hareng saur, concentré de tomate, oignon et poivron, épi | cuire les pâtes, sauter dans la sauce aux saucisses | matin |  |
| Ropa vieja | Cuba | bœuf (flanc) effiloché, tomate, poivron, oignon, ail, cumin et origan | cuire et effilocher la viande, mijoter dans un sofrito | midi, soir |  |
| Congrí / moros y cristianos | Cuba | riz, haricots rouges (congrí) ou noirs (moros), oignon et poivron, ail, cumin, lard (facultatif) | revenir un sofrito, cuire le riz avec les haricots et leur bouillon | midi, soir |  |
| Frijoles negros | Cuba | haricots noirs, oignon, poivron, ail, cumin et origan, vinaigre ou vin | cuire les haricots, ajouter un sofrito et épaissir | midi, soir | vegan |
| Yuca con mojo | Cuba | manioc, ail, orange amère (ou citron vert), huile, oignon | cuire le manioc à l'eau, arroser d'un mojo chaud à l'ail | midi, soir | vegan |
| Tostones | Cuba, Porto Rico, République dominicaine | bananes plantains vertes, huile de friture, sel, ail (facultatif) | frire une première fois, aplatir, refrire | midi, soir, encas | vegan |
| Ajiaco cubano | Cuba | viandes (porc, poulet, bœuf séché), maïs en épi, tubercules (manioc, malanga, patate douce), banane plantain, potiron, citron vert | mijoter longuement viandes et légumes jusqu'à épaississement | midi |  |
| Mangú | République dominicaine | bananes plantains vertes, beurre ou huile, oignon rouge au vinaigre, fromage frit, salami, œufs (los tres golpes) | cuire et écraser les plantains, garnir d'oignons revenus au vinaigre | matin, soir | végétarien |
| La bandera (riz, habichuelas et viande) | République dominicaine | riz blanc, habichuelas guisadas (haricots en sauce), viande en sauce (poulet, bœuf), salade | cuire le riz, servir avec haricots mijotés et viande guisada | midi |  |
| Habichuelas guisadas | République dominicaine, Porto Rico | haricots rouges, potiron (auyama), sofrito (oignon, poivron, ail), concentré de tomate, coriandre | mijoter les haricots avec le sofrito, épaissir avec le potiron écrasé | midi, soir | vegan |
| Sancocho dominicano | République dominicaine | plusieurs viandes (poulet, porc, bœuf), tubercules (igname, manioc, malanga), banane plantain verte, maïs, potiron, coriandre | mijoter longuement viandes et tubercules jusqu'à épaississement | midi |  |
| Moro de guandules | République dominicaine | riz, pois d'Angole (guandules), lait de coco (facultatif), sofrito, olives | revenir le sofrito, cuire le riz avec les pois | midi | vegan |
| Avena caliente | République dominicaine, Porto Rico | flocons d'avoine, lait (ou lait concentré), sucre, cannelle, vanille | cuire l'avoine dans le lait sucré et épicé | matin | végétarien |
| Arroz con gandules | Porto Rico | riz, pois d'Angole (gandules), sofrito (ail, poivron, ají dulce, coriandre), porc ou jambon, olives et câpres, rocou (achiote) | revenir sofrito et viande, cuire le riz avec les pois | midi, soir |  |
| Mofongo | Porto Rico | bananes plantains vertes, ail, chicharrón ou lard, huile d'olive, bouillon | frire les plantains, piler au mortier avec l'ail et le porc | midi, soir |  |
| Pastelón | Porto Rico, République dominicaine | bananes plantains mûres, viande hachée en picadillo, fromage, œufs | frire les plantains en lamelles, monter en couches avec la viande, cuire au four | midi, soir |  |
| Bacalaítos | Porto Rico | morue salée, farine, levure chimique, ail, coriandre | préparer une pâte fluide à la morue, frire en galettes fines | encas |  |
| Ackee and saltfish | Jamaïque | ackee, morue salée, oignon, tomate, piment scotch bonnet, thym | dessaler et effeuiller la morue, sauter avec les aromates, ajouter l'ackee délicatement | matin |  |
| Callaloo (jamaïcain) | Jamaïque | feuilles de callaloo (amarante) ou épinards, oignon, tomate, ail, thym, piment scotch bonnet | étuver les feuilles émincées avec les aromates | matin, midi | vegan |
| Rice and peas | Jamaïque | riz, haricots rouges, lait de coco, oignon vert, thym, piment scotch bonnet entier | cuire les haricots, cuire le riz dans le lait de coco et le bouillon | midi, soir | vegan |
| Brown stew chicken | Jamaïque | poulet, sucre roussi (browning), oignon et poivron, tomate, thym, piment | mariner, dorer puis braiser en sauce brune | midi, soir |  |
| Curry goat | Jamaïque, Trinité-et-Tobago | cabri, poudre de curry, oignon et ail, thym, piment scotch bonnet, pomme de terre | mariner aux épices, braiser longuement | midi, soir |  |
| Jerk chicken | Jamaïque | poulet, piment scotch bonnet, piment de la Jamaïque (allspice), oignon vert, thym, ail et gingembre | mariner dans la pâte jerk, griller lentement au feu de bois | midi, soir |  |
| Escovitch fish | Jamaïque | poisson entier (vivaneau), vinaigre, oignon, carotte et poivron, piment, piment de la Jamaïque (allspice) | frire le poisson, napper de légumes marinés au vinaigre chaud | midi, soir |  |
| Run down | Jamaïque | maquereau salé ou poisson, lait de coco, oignon, tomate, thym, piment | réduire le lait de coco jusqu'à ce qu'il se sépare, mijoter le poisson dedans | matin, soir |  |
| Cornmeal porridge | Jamaïque | semoule de maïs fine, lait (ou lait de coco), lait concentré sucré, cannelle et muscade, vanille | délayer la semoule, cuire en remuant jusqu'à épaississement | matin | végétarien |
| Fried dumplings (Johnny cakes) | Jamaïque | farine, levure chimique, sel, eau, huile de friture | pétrir une pâte ferme, frire en boules aplaties | matin | vegan |
| Doubles | Trinité-et-Tobago | farine, curcuma, pois chiches (channa), curry et cumin, chutney (tamarin, mangue), piment | frire de petits pains plats (bara), garnir de curry de pois chiches | matin, encas | vegan |
| Curry channa and aloo | Trinité-et-Tobago | pois chiches, pommes de terre, poudre de curry, oignon et ail, cumin (geera), chadon béni (coriandre longue) | griller le curry dans l'huile, mijoter pois chiches et pommes de terre | midi, soir | vegan |
| Dhalpuri roti | Trinité-et-Tobago, Guyana | farine, pois cassés jaunes moulus épicés, cumin (geera), ail, huile | farcir la pâte de pois cassés, étaler finement, cuire sur une plaque (tawa) | midi, soir | vegan |
| Pelau | Trinité-et-Tobago | poulet, riz, pois d'Angole, sucre caramélisé, lait de coco, potiron et carotte | caraméliser le sucre et y dorer le poulet, cuire le riz et les pois en une seule marmite | midi, soir |  |
| Baigan choka | Trinité-et-Tobago | aubergine, ail, oignon, tomate, piment | griller l'aubergine sur la flamme, écraser et arroser d'huile chaude aux aromates | matin, soir | vegan |
| Buljol | Trinité-et-Tobago | morue salée, tomate, oignon, poivron, piment, huile | dessaler et émietter la morue, mélanger aux crudités hachées | matin |  |
| Bake and saltfish | Trinité-et-Tobago | farine, levure chimique, morue salée, oignon et tomate, huile de friture | frire des petits pains (fry bake), garnir de morue sautée | matin, encas |  |

<a id="amerique-sud"></a>

## Amérique du Sud (60 plats)

| Plat | Pays | Ingrédients essentiels | Techniques | Moments | Régime |
|---|---|---|---|---|---|
| Ceviche | Pérou, Équateur | poisson blanc cru, citron vert, oignon rouge, piment (ají limo ou rocoto), coriandre, patate douce et maïs (accompagnement) | couper le poisson en dés, le mariner quelques minutes dans le citron | midi |  |
| Lomo saltado | Pérou | bœuf en lanières, oignon rouge, tomate, sauce soja et vinaigre, piment jaune (ají amarillo), frites et riz | sauter à feu très vif au wok, mélanger aux frites au dernier moment | midi, soir |  |
| Ají de gallina | Pérou | poulet effiloché, piment jaune (ají amarillo), pain de mie trempé dans le lait, oignon et ail, fromage ou noix, pommes de terre, œuf dur et riz | mixer une sauce crémeuse au pain et au piment, y réchauffer le poulet effiloché | midi |  |
| Papa a la huancaína | Pérou | pommes de terre, fromage frais, piment jaune (ají amarillo), lait, biscuits salés (pour lier), œuf dur et olives | cuire les pommes de terre, mixer la sauce au fromage et piment, napper | midi | végétarien |
| Causa limeña | Pérou | pommes de terre jaunes, piment jaune (ají amarillo), citron vert, garniture (thon ou poulet à la mayonnaise), avocat | écraser les pommes de terre assaisonnées, monter en couches avec la garniture | midi |  |
| Tacu tacu | Pérou | riz cuit de la veille, haricots (canarios) cuits, oignon et ail, piment jaune | mélanger riz et haricots écrasés, dorer à la poêle en galette | midi, soir | vegan |
| Pan con chicharrón | Pérou | pain, porc confit puis frit, patate douce frite, salsa criolla (oignon rouge, citron, piment) | cuire le porc dans sa graisse jusqu'à dorure, garnir le pain | matin |  |
| Tamal peruano | Pérou | maïs moulu, saindoux, piment (ají panca ou amarillo), poulet ou porc, œuf dur et olive, feuilles de bananier | assaisonner la pâte de maïs, envelopper la garniture, cuire à la vapeur | matin |  |
| Sopa de quinua | Pérou, Bolivie, Équateur | quinoa, pomme de terre, carotte, oignon, fromage frais ou viande (facultatif) | rincer la quinoa, mijoter avec les légumes en soupe | midi, soir | vegan |
| Arepas | Venezuela, Colombie | farine de maïs précuite, eau, sel, garniture (fromage, haricots noirs, poulet-avocat, œufs) | former des galettes, cuire sur une plaque puis au four, ouvrir et garnir | matin, soir, encas | végétarien |
| Huevos pericos (perico) | Colombie, Venezuela | œufs, tomate, oignon vert ou oignon | revenir tomate et oignon, brouiller les œufs dedans | matin | végétarien |
| Changua | Colombie (Andes) | lait, eau, œufs, oignon vert, coriandre, pain rassis (calado) | pocher les œufs dans le lait chaud, verser sur le pain | matin | végétarien |
| Calentado | Colombie | riz de la veille, haricots de la veille, restes de viande, œuf au plat, arepa | réchauffer ensemble les restes à la poêle | matin |  |
| Ajiaco santafereño | Colombie (Bogotá) | poulet, trois sortes de pommes de terre (dont la papa criolla), maïs en épi, guascas (herbe), crème et câpres, avocat | mijoter jusqu'à ce que les pommes de terre se défassent et épaississent la soupe | midi |  |
| Sancocho | Colombie, Venezuela, Équateur | poulet, poisson ou bœuf, manioc, banane plantain verte, pomme de terre, maïs en épi, coriandre | mijoter longuement viande et tubercules en soupe épaisse | midi |  |
| Frijoles antioqueños | Colombie | haricots rouges (cargamanto), lard ou couenne de porc, banane plantain verte, carotte, hogao (tomate et oignon vert revenus) | cuire les haricots avec le porc, ajouter le hogao et râper le plantain pour épaissir | midi |  |
| Bandeja paisa | Colombie (Antioquia) | haricots rouges, riz, viande hachée ou chicharrón, chorizo, œuf au plat, banane plantain mûre, avocat et arepa | préparer chaque élément séparément, dresser en une grande assiette | midi |  |
| Patacones | Colombie, Venezuela, Équateur | bananes plantains vertes, huile de friture, sel, hogao ou guacamole (facultatif) | frire, aplatir, refrire | midi, encas | vegan |
| Pandebono | Colombie | amidon de manioc, fromage frais émietté, farine de maïs, œuf | pétrir, façonner en boules ou anneaux, cuire au four | matin, encas | végétarien |
| Pabellón criollo | Venezuela | bœuf effiloché (carne mechada), haricots noirs, riz blanc, banane plantain mûre frite, tomate, oignon, poivron | cuire et effilocher la viande, la mijoter en sofrito, servir avec haricots, riz et plantain | midi |  |
| Cachapas | Venezuela | maïs frais, sucre, lait ou œuf, fromage frais (queso de mano) | mixer le maïs en pâte, cuire en crêpes épaisses sur une plaque, garnir de fromage | matin, encas | végétarien |
| Tequeños | Venezuela | pâte de blé, fromage blanc à pâte ferme, huile de friture | enrouler la pâte autour de bâtonnets de fromage, frire | encas | végétarien |
| Hallacas | Venezuela | pâte de maïs au rocou, ragoût de viandes (porc, poulet, bœuf), olives, raisins secs, câpres, feuilles de bananier | préparer le ragoût la veille, garnir et envelopper, cuire à l'eau | midi, soir |  |
| Encebollado | Équateur | thon (albacore), manioc, oignon rouge mariné, tomate, cumin, coriandre | cuire le manioc et le poisson dans un bouillon épicé, garnir d'oignon mariné | matin, midi |  |
| Locro de papa | Équateur | pommes de terre, lait, fromage frais, oignon, rocou (achiote), avocat | cuire les pommes de terre jusqu'à ce qu'elles se défassent, lier avec le lait et le fromage | midi, soir | végétarien |
| Llapingachos | Équateur | pommes de terre, fromage, oignon, rocou (achiote), sauce cacahuète (facultatif) | écraser les pommes de terre, farcir de fromage, dorer à la poêle | midi, soir | végétarien |
| Bolón de verde | Équateur | bananes plantains vertes, fromage ou chicharrón, beurre ou saindoux | cuire et piler le plantain, farcir en boule, dorer à la poêle | matin | végétarien |
| Menestra | Équateur | lentilles ou haricots, oignon, poivron, ail, cumin, coriandre | revenir un refrito, mijoter les légumineuses jusqu'à texture épaisse | midi, soir | vegan |
| Humitas | Équateur, Pérou, Bolivie, Chili, Argentine | maïs frais râpé, oignon, fromage (ou sucre selon la région), beurre ou saindoux, feuilles de maïs | mixer le maïs avec l'assaisonnement, envelopper dans les feuilles, cuire à la vapeur ou à l'eau | matin, encas, midi | végétarien |
| Salteñas | Bolivie | pâte de blé légèrement sucrée, viande (bœuf ou poulet) en ragoût juteux, pomme de terre et petits pois, piment (ají), œuf dur et olive | préparer un ragoût gélifié, refermer en chausson, cuire au four | matin, encas |  |
| Silpancho | Bolivie (Cochabamba) | bœuf aplati et pané, riz, pommes de terre, œuf au plat, salsa de tomate et oignon | aplatir et paner la viande, frire, dresser en couches | midi, soir |  |
| Sopa de maní | Bolivie | arachides crues mixées, bœuf avec os, pommes de terre, macaronis, carotte et petits pois | mixer les arachides, les cuire longuement dans le bouillon, garnir de frites ou de persil | midi |  |
| Api con pastel | Bolivie | maïs violet moulu, cannelle et clou de girofle, sucre, beignet au fromage (pastel) | cuire la boisson épaisse au maïs, frire le beignet au fromage | matin, encas | végétarien |
| Arroz e feijão | Brésil | riz, haricots (noirs ou carioca), ail, oignon, laurier, lard (facultatif) | cuire les haricots, les relever d'ail et d'oignon revenus (tempero), servir avec le riz | midi, soir | vegan |
| Feijoada | Brésil | haricots noirs, viandes de porc salées et fumées, saucisse (linguiça), orange, chou (couve) et farofa en accompagnement | mijoter longuement les haricots avec les viandes | midi |  |
| Farofa | Brésil | farine de manioc, beurre, oignon, lard, œuf ou banane (facultatif) | revenir l'oignon, griller la farine dans le beurre | midi, soir | végétarien |
| Couve refogada | Brésil | chou cavalier (couve) en fines lanières, ail, huile | émincer très finement, sauter rapidement à l'ail | midi, soir | vegan |
| Moqueca | Brésil (Bahia, Espírito Santo) | poisson ou crevettes, tomate, oignon et poivron, coriandre, lait de coco et huile de palme (Bahia), citron vert | mariner le poisson au citron, étager poisson et légumes, mijoter à couvert | midi |  |
| Baião de dois | Brésil (Nordeste) | riz, haricots (feijão de corda), fromage coalho, viande séchée ou bacon, oignon et coriandre | cuire riz et haricots ensemble, ajouter le fromage en dés | midi, soir |  |
| Pão de queijo | Brésil (Minas Gerais) | amidon de manioc (polvilho), fromage râpé, lait, huile, œufs | échauder l'amidon, incorporer fromage et œufs, cuire au four en boules | matin, encas | végétarien |
| Tapioca | Brésil (Nordeste) | fécule de manioc hydratée, garniture (fromage, coco, beurre, œuf) | étaler la fécule à la poêle sèche, garnir et plier | matin, encas | végétarien |
| Cuscuz nordestino | Brésil (Nordeste) | semoule de maïs en flocons (flocão), eau, sel, beurre, œuf ou fromage (facultatif) | humidifier la semoule, cuire à la vapeur dans un cuscuzeiro | matin, soir | végétarien |
| Coxinha | Brésil | poulet effiloché, pâte de farine cuite dans le bouillon, fromage frais (catupiry, facultatif), chapelure | façonner en goutte autour de la farce, paner, frire | encas |  |
| Bolo de fubá | Brésil | farine de maïs (fubá), œufs, lait, sucre, huile, fenouil (facultatif) | mélanger la pâte, cuire au four | matin, encas | végétarien |
| Empanadas | Argentine, Chili, Uruguay, Colombie | pâte de blé, viande hachée ou au couteau, oignon, œuf dur, olives (Chili) ou cumin et paprika (Argentine) | préparer une farce à l'oignon, refermer en chausson, cuire au four ou frire | midi, soir, encas |  |
| Milanesa | Argentine, Uruguay, Paraguay | escalope de bœuf ou poulet, œuf, chapelure, ail et persil, purée ou frites | aplatir, paner, frire ou cuire au four | midi, soir |  |
| Locro | Argentine, Bolivie, Paraguay | maïs blanc concassé, haricots blancs, potiron, viandes (porc, bœuf, chorizo), sauce rouge au paprika (grasita colorada) | mijoter très longuement jusqu'à texture crémeuse | midi |  |
| Guiso de lentejas | Argentine, Uruguay | lentilles, oignon et poivron, carotte et pomme de terre, potiron, chorizo ou lard (facultatif), tomate | revenir les légumes, mijoter avec les lentilles | midi, soir |  |
| Tarta de verdura (pascualina) | Argentine, Uruguay | pâte brisée, blettes ou épinards, oignon, œufs, fromage | étuver les légumes, garnir la pâte, cuire au four | midi, soir | végétarien |
| Torta frita | Uruguay, Argentine | farine, graisse (saindoux) ou beurre, sel, eau, sucre (facultatif) | étaler une pâte simple, frire en galettes | encas |  |
| Polenta | Argentine, Uruguay, Brésil (sud) | semoule de maïs, eau ou bouillon, fromage, sauce tomate (tuco) ou ragoût | cuire la semoule en remuant, servir avec une sauce | midi, soir | végétarien |
| Sopa paraguaya | Paraguay | farine de maïs, fromage, oignon, lait, œufs, graisse ou beurre | revenir l'oignon, mélanger la pâte, cuire au four comme un gâteau salé | midi, encas | végétarien |
| Chipa | Paraguay, Argentine (nord-est) | amidon de manioc, fromage, œufs, graisse ou beurre, anis (facultatif) | pétrir, façonner en anneaux ou boules, cuire au four | matin, encas | végétarien |
| Mbejú | Paraguay | amidon de manioc, fromage, graisse ou beurre, lait | sabler l'amidon avec la graisse, cuire en galette à la poêle | matin, encas | végétarien |
| Vorí vorí | Paraguay | poulet, boulettes de farine de maïs et fromage, oignon et poivron, carotte, persil | préparer un bouillon de poulet, y cuire les boulettes de maïs | midi, soir |  |
| Pastel de choclo | Chili | maïs frais mixé, basilic, viande hachée à l'oignon (pino), poulet, œuf dur et olive, sucre | préparer le pino, couvrir de pâte de maïs, gratiner au four | midi |  |
| Cazuela | Chili | poulet ou bœuf, pomme de terre, potiron, maïs en épi, riz ou haricots verts | cuire la viande, ajouter un gros morceau de chaque légume au bouillon | midi |  |
| Porotos granados | Chili | haricots frais écossés, maïs frais râpé (pilco), potiron, oignon, basilic, paprika | mijoter les haricots avec le potiron, lier avec le maïs râpé | midi | vegan |
| Charquicán | Chili | viande (bœuf haché ou séché), pomme de terre, potiron, oignon, maïs et petits pois, œuf au plat | revenir la viande, cuire les légumes et écraser grossièrement | midi |  |
| Sopaipillas | Chili, Argentine | farine, potiron cuit (Chili), graisse ou beurre, levure chimique, pebre (sauce tomate-coriandre) ou sirop (chancaca) | pétrir avec le potiron, frire en disques | encas | végétarien |

<a id="europe-sud"></a>

## Europe du Sud (60 plats)

| Plat | Pays | Ingrédients essentiels | Techniques | Moments | Régime |
|---|---|---|---|---|---|
| Pasta e fagioli | Italie | pâtes courtes, haricots borlotti (ou cannellini), oignon, carotte, céleri, tomate (concentré ou pelées), huile d'olive, lardons ou couenne (pancetta, souvent) | faire un soffritto, mijoter les haricots, écraser une partie des haricots pour lier | midi, soir |  |
| Pasta e ceci | Italie (Rome, Sud) | pois chiches, pâtes courtes (ou spaghetti cassés), ail, romarin, huile d'olive, tomate (facultative) | mijoter les pois chiches, mixer une partie pour lier, cuire les pâtes dans le bouillon | midi, soir | vegan |
| Minestrone | Italie | légumes de saison (courgette, carotte, céleri, chou, pomme de terre), haricots, oignon, tomate, petites pâtes ou riz, parmesan (ou croûte de parmesan) | faire un soffritto, mijoter longuement les légumes en dés | midi, soir | végétarien |
| Ribollita | Italie (Toscane) | pain rassis, chou noir (cavolo nero, ou chou vert), haricots cannellini, oignon, carotte, céleri, tomate, huile d'olive | mijoter une soupe de légumes et haricots, ajouter le pain rassis, réchauffer le lendemain | midi, soir | vegan |
| Pappa al pomodoro | Italie (Toscane) | pain rassis, tomates, ail, basilic, huile d'olive, bouillon de légumes | mijoter tomate et pain jusqu'à consistance de bouillie | midi, soir | vegan |
| Panzanella | Italie (Toscane) | pain rassis, tomates, oignon rouge, concombre, basilic, huile d'olive et vinaigre | tremper le pain et l'essorer, mélanger en salade | midi, soir | vegan |
| Spaghetti aglio, olio e peperoncino | Italie | spaghetti, ail, huile d'olive, piment, persil (facultatif) | dorer l'ail à feu doux dans l'huile, lier avec l'eau de cuisson des pâtes | midi, soir | vegan |
| Pasta alla Norma | Italie (Sicile) | pâtes (maccheroni, rigatoni), aubergine, sauce tomate, ail, basilic, ricotta salata | frire l'aubergine en dés, mijoter la sauce tomate | midi, soir | végétarien |
| Spaghetti alla carbonara | Italie (Rome) | spaghetti (ou rigatoni), guanciale (ou pancetta), jaunes d'œufs (ou œufs entiers), pecorino romano, poivre noir | rissoler le guanciale, lier hors du feu œufs et fromage avec l'eau de cuisson | midi, soir |  |
| Tagliatelle al ragù (ragù alla bolognese) | Italie (Émilie-Romagne) | viande hachée (bœuf, porc), oignon, carotte, céleri, tomate (concentré ou passata), vin, lait, tagliatelle | faire un soffritto, mijoter plusieurs heures à feu doux | midi, soir |  |
| Risotto alla milanese | Italie (Lombardie) | riz à risotto (arborio, carnaroli), safran, oignon, beurre, parmesan, bouillon | nacrer le riz, mouiller au bouillon louche par louche, lier au beurre et au parmesan | midi, soir |  |
| Frittata | Italie | œufs, légumes (courgette, oignon, pomme de terre) ou restes de pâtes, parmesan, huile d'olive | cuire à la poêle à feu doux, retourner à l'aide d'une assiette | midi, soir, encas | végétarien |
| Parmigiana di melanzane | Italie (Sud) | aubergines, sauce tomate, mozzarella (ou scamorza), parmesan, basilic | frire les tranches d'aubergine, monter en couches, cuire au four | midi, soir | végétarien |
| Polenta | Italie (Nord) | farine de maïs, eau salée, beurre, fromage (parmesan, fontina) | verser la farine en pluie, remuer longuement, servir molle ou grillée en tranches | midi, soir | végétarien |
| Gnocchi di patate | Italie | pommes de terre farineuses, farine, œuf (facultatif), sauce (tomate, beurre-sauge) | écraser les pommes de terre cuites, façonner les gnocchi, pocher jusqu'à ce qu'ils remontent | midi, soir | végétarien |
| Polpette al sugo | Italie | viande hachée, pain rassis trempé dans le lait, œuf, parmesan, sauce tomate, persil | façonner les boulettes, dorer puis mijoter dans la sauce tomate | midi, soir |  |
| Pollo alla cacciatora | Italie | poulet en morceaux, tomate, oignon, ail, romarin, vin (blanc ou rouge), olives (selon les régions) | dorer le poulet, mijoter en cocotte | midi, soir |  |
| Pesce all'acqua pazza | Italie (Campanie) | poisson blanc entier ou en filets (daurade, bar, cabillaud), tomates cerises, ail, persil, huile d'olive | pocher le poisson dans un fond court d'eau, tomate et huile | midi, soir |  |
| Caponata | Italie (Sicile) | aubergines, céleri, oignon, tomate, olives et câpres, vinaigre et sucre | frire l'aubergine, mijoter en aigre-doux | midi, soir | vegan |
| Fave e cicoria | Italie (Pouilles) | fèves sèches décortiquées, chicorée sauvage (ou blettes, épinards), huile d'olive, ail | cuire et écraser les fèves en purée, blanchir puis faire sauter la chicorée | midi, soir | vegan |
| Arancini | Italie (Sicile) | riz cuit (souvent au safran), farce (ragù et petits pois, ou jambon et mozzarella), œuf, chapelure | façonner des boules de riz farcies, paner, frire | encas, midi |  |
| Focaccia genovese | Italie (Ligurie) | farine, levure, huile d'olive, eau, gros sel | pétrir une pâte souple, marquer d'alvéoles avec les doigts, cuire au four | matin, encas | vegan |
| Ciambellone | Italie | farine, œufs, sucre, huile ou beurre, lait, zeste de citron | fouetter œufs et sucre, cuire au four dans un moule en couronne | matin, encas | végétarien |
| Tortilla española (tortilla de patatas) | Espagne | pommes de terre, œufs, oignon (selon les goûts), huile d'olive | confire les pommes de terre dans l'huile, cuire à la poêle et retourner | matin, midi, soir, encas | végétarien |
| Pan con tomate (pa amb tomàquet) | Espagne (Catalogne, puis tout le pays) | pain, tomate bien mûre, huile d'olive, sel, ail (facultatif) | griller le pain, frotter ou râper la tomate dessus | matin, encas, soir | vegan |
| Gazpacho | Espagne (Andalousie) | tomates mûres, concombre, poivron vert, ail, pain rassis, huile d'olive et vinaigre | mixer cru, servir très frais | midi, soir | vegan |
| Salmorejo | Espagne (Cordoue, Andalousie) | tomates, pain rassis, ail, huile d'olive, œuf dur et jambon cru en garniture | mixer tomate et pain en crème épaisse, servir frais | midi, soir |  |
| Paella valenciana | Espagne (Valence) | riz rond (bomba), poulet et lapin, haricots plats (ferraura) et haricots blancs (garrofó), tomate, safran, huile d'olive | dorer les viandes dans la paellera, cuire le riz sans remuer, laisser attacher (socarrat) | midi |  |
| Lentejas estofadas | Espagne | lentilles, chorizo, pomme de terre, carotte, oignon, paprika (pimentón) | mijoter en ragoût | midi, soir |  |
| Cocido madrileño | Espagne (Madrid) | pois chiches, bœuf (jarret), chorizo et morcilla, lard (tocino), chou, carotte et pomme de terre | mijoter longuement, servir en plusieurs services (bouillon aux vermicelles, puis légumes et viandes) | midi |  |
| Garbanzos con espinacas | Espagne (Séville, Andalousie) | pois chiches cuits, épinards, ail, pain frit, cumin, paprika (pimentón), vinaigre | piler pain frit, ail et épices, mijoter avec les pois chiches et les épinards | midi, soir, encas | vegan |
| Pisto manchego | Espagne (La Manche) | tomates, poivrons, courgette, oignon, huile d'olive, œuf au plat (souvent en accompagnement) | mijoter lentement les légumes en dés | midi, soir | végétarien |
| Migas | Espagne (Estrémadure, La Manche, Aragon), Portugal | pain rassis émietté et humidifié, ail, chorizo ou lard, paprika (pimentón), huile d'olive | humidifier le pain la veille, faire revenir longuement à la poêle en remuant | matin, midi |  |
| Croquetas | Espagne | béchamel épaisse, restes (jambon, poulet, viande du cocido, morue), œuf, chapelure | faire une béchamel ferme et la refroidir, façonner et paner, frire | encas, soir |  |
| Merluza en salsa verde | Espagne (Pays basque) | merlu (ou autre poisson blanc), ail, persil, huile d'olive, vin blanc ou fumet, palourdes (facultatif) | cuire doucement en sauteuse, lier la sauce en remuant la poêle | midi, soir |  |
| Churros con chocolate | Espagne | farine, eau, sel, huile de friture, chocolat chaud épais (chocolat, lait, maïzena) | pocher la pâte à la douille cannelée, frire | matin, encas | végétarien |
| Torrijas | Espagne | pain rassis, lait (ou vin), œufs, sucre, cannelle, huile de friture | tremper le pain, passer dans l'œuf et frire | encas, matin | végétarien |
| Caldo verde | Portugal | pommes de terre, chou vert (couve galega) en fines lanières, oignon et ail, huile d'olive, chouriço en rondelles | mixer la base pomme de terre, ajouter le chou émincé en fin de cuisson | midi, soir |  |
| Bacalhau à Brás | Portugal | morue dessalée effilochée, pommes de terre en allumettes frites, œufs, oignon, olives noires, persil | faire revenir morue et oignon, lier aux œufs brouillés | midi, soir |  |
| Pastéis de bacalhau (bolinhos de bacalhau) | Portugal | morue dessalée, pommes de terre, œufs, oignon, persil | façonner des quenelles à deux cuillères, frire | encas, midi, soir |  |
| Açorda alentejana | Portugal (Alentejo) | pain rassis, ail, coriandre fraîche, huile d'olive, œufs pochés, eau bouillante | piler ail, coriandre et sel, verser l'eau bouillante sur le pain, pocher les œufs | midi, soir | végétarien |
| Pastel de nata | Portugal | pâte feuilletée, jaunes d'œufs, lait, sucre, farine, cannelle | foncer de petits moules, cuire à four très chaud | matin, encas | végétarien |
| Fasolada | Grèce, Chypre | haricots blancs secs, carotte, céleri, oignon, tomate, huile d'olive | mijoter longuement en soupe épaisse | midi, soir | vegan |
| Fakes (soupe de lentilles) | Grèce | lentilles brunes, oignon, ail, tomate (concentré), laurier, huile d'olive et vinaigre | mijoter, finir avec un trait de vinaigre | midi, soir | vegan |
| Gemista | Grèce | tomates et poivrons, riz, oignon, herbes (menthe, persil, aneth), huile d'olive, pommes de terre en quartiers | évider les légumes et farcir de riz cru assaisonné, cuire au four | midi, soir | vegan |
| Briam | Grèce | courgettes, aubergines, pommes de terre, tomates, oignon, huile d'olive | rôtir longuement au four les légumes en morceaux | midi, soir | vegan |
| Spanakopita | Grèce | épinards (ou blettes, herbes sauvages), feta, œufs, oignon nouveau, aneth, pâte filo | monter en couches de filo huilées, cuire au four | midi, soir, encas | végétarien |
| Tiropita | Grèce | feta, œufs, yaourt ou lait, pâte filo, beurre ou huile | monter en couches ou rouler, cuire au four | matin, encas | végétarien |
| Moussaka | Grèce | aubergines, viande hachée (agneau ou bœuf), tomate, cannelle, béchamel, pommes de terre (souvent) | frire ou rôtir les aubergines, monter en couches, gratiner au four | midi, soir |  |
| Avgolemono (soupe) | Grèce, Chypre | bouillon de poulet, riz (ou orzo), œufs, citron, poulet (facultatif) | tempérer l'œuf battu au citron avec le bouillon chaud, lier sans faire bouillir | midi, soir |  |
| Horiatiki (salade grecque) | Grèce | tomates, concombre, oignon rouge, poivron vert, olives, feta, origan et huile d'olive | couper gros, sans laitue, assaisonner à l'huile et à l'origan | midi, soir | végétarien |
| Strapatsada (kagianas) | Grèce | œufs, tomates mûres râpées, feta, huile d'olive | réduire la tomate à la poêle, brouiller les œufs dedans | matin, midi, soir | végétarien |
| Bougatsa | Grèce (Thessalonique, Macédoine) | pâte filo, crème à la semoule (lait, semoule, œufs, sucre) ou feta, beurre, cannelle et sucre glace | monter la filo beurrée autour de la crème, cuire au four | matin, encas | végétarien |
| Koulouri Thessalonikis | Grèce | farine, levure, eau, graines de sésame, mélasse ou miel dilué (pour dorer) | façonner des couronnes, tremper dans le sirop puis le sésame, cuire au four | matin, encas | vegan |
| Yaourt au miel (giaourti me meli) | Grèce | yaourt grec égoutté, miel, noix (facultatif) | napper de miel au moment de servir | matin, encas | végétarien |
| Louvi me lahana | Chypre | haricots cornille (black-eyed peas), blettes (ou autres verdures), huile d'olive, citron | cuire les haricots et les verdures ensemble, assaisonner à l'huile et au citron | midi, soir | vegan |
| Burek | Croatie, Bosnie-Herzégovine, Serbie (Balkans) | pâte filo (ou pâte étirée), viande hachée, fromage frais ou épinards, oignon, huile | rouler ou superposer la pâte garnie, cuire au four | matin, encas, midi |  |
| Blitva | Croatie (Dalmatie) | blettes, pommes de terre, ail, huile d'olive | cuire à l'eau, écraser grossièrement avec l'huile et l'ail | midi, soir | vegan |
| Brudet (brodetto) | Croatie (côte adriatique), Italie (Adriatique) | poissons variés en morceaux, oignon, tomate (concentré), vin, vinaigre, huile d'olive | mijoter sans remuer en secouant la cocotte | midi, soir |  |
| Pašticada | Croatie (Dalmatie) | bœuf (gîte) piqué de lard et d'ail, vinaigre de vin, vin rouge (ou prošek), pruneaux, carotte et oignon, gnocchis (en accompagnement) | mariner la viande la veille, braiser longuement | midi |  |

<a id="levant-turquie"></a>

## Proche-Orient et Turquie (56 plats)

| Plat | Pays | Ingrédients essentiels | Techniques | Moments | Régime |
|---|---|---|---|---|---|
| Ful medames | Égypte, Liban, Syrie, Palestine, Jordanie | fèves sèches cuites (ful), ail, citron, huile d'olive, cumin, tomate, persil (en garniture) | mijoter longuement les fèves, écraser grossièrement et assaisonner | matin, soir | vegan |
| Ta'ameya (falafel) | Égypte (fèves), Liban, Syrie, Palestine, Jordanie, Israël (pois chiches) | fèves sèches ou pois chiches trempés (non cuits), oignon et ail, persil et coriandre, cumin et coriandre moulue, pain pita et tahini (pour servir) | hacher cru les légumineuses trempées, façonner des boulettes, frire | matin, midi, encas | vegan |
| Hummus bi tahini | Liban, Syrie, Palestine, Jordanie, Israël | pois chiches cuits, tahini, citron, ail, huile d'olive | mixer finement les pois chiches chauds, monter avec le tahini et le citron | matin, midi, soir, encas | vegan |
| Fatteh hummus | Syrie, Liban, Palestine, Jordanie | pain pita rassis grillé ou frit, pois chiches cuits, yaourt à l'ail, tahini, pignons ou amandes grillés au beurre | monter en couches pain, pois chiches chauds, sauce yaourt | matin, midi | végétarien |
| Balila | Liban, Syrie, Palestine | pois chiches cuits chauds, ail, cumin, citron, huile d'olive | assaisonner les pois chiches entiers encore chauds | matin, encas | vegan |
| Man'oushe za'atar | Liban, Syrie, Palestine, Jordanie | pâte à pain levée, za'atar (thym, sumac, sésame), huile d'olive | étaler la pâte, napper du mélange za'atar-huile, cuire au four très chaud | matin, encas | vegan |
| Labneh | Liban, Syrie, Palestine, Jordanie | yaourt égoutté, sel, huile d'olive, za'atar ou menthe séchée, pain, concombre, olives (pour servir) | égoutter le yaourt salé dans un linge | matin, soir | végétarien |
| Ka'ak al-Quds (pain au sésame) | Palestine (Jérusalem) | farine, levure, graines de sésame, lait ou eau, za'atar et œuf dur (pour servir) | façonner des anneaux allongés, rouler dans le sésame, cuire au four | matin, encas | végétarien |
| Shakshuka | Israël, Palestine (venue du Maghreb) | œufs, tomates, poivrons, oignon, ail, cumin et paprika | mijoter une sauce tomate-poivron, pocher les œufs dans la sauce | matin, midi, soir | végétarien |
| Galayet bandora | Jordanie, Palestine | tomates, ail, piment vert, huile d'olive, pain pour saucer | faire fondre les tomates à la poêle dans l'huile | matin, midi, soir | vegan |
| Sabich | Israël (d'origine juive irakienne) | pain pita, aubergine frite, œuf dur, tahini, salade tomate-concombre, amba (condiment à la mangue) | frire les tranches d'aubergine, garnir la pita | matin, midi, encas | végétarien |
| Menemen | Turquie | œufs, tomates, poivrons verts, oignon (selon les familles), huile ou beurre, piment (pul biber) | fondre poivrons et tomates, brouiller les œufs dedans | matin | végétarien |
| Sucuklu yumurta | Turquie | sucuk (saucisse de bœuf épicée), œufs, beurre | dorer les rondelles de sucuk, cuire les œufs au plat dessus | matin |  |
| Çılbır | Turquie | œufs pochés, yaourt à l'ail, beurre fondu au piment (pul biber), pain | pocher les œufs, napper de beurre pimenté | matin | végétarien |
| Simit | Turquie | farine, levure, mélasse de raisin (pekmez), graines de sésame | torsader des anneaux, tremper dans la mélasse diluée puis le sésame, cuire au four | matin, encas | vegan |
| Gözleme | Turquie | pâte fine (farine, eau, sel), garniture : fromage frais et persil, épinards, pomme de terre ou viande hachée, beurre | étaler très finement, garnir, plier et cuire sur une plaque (sac) | matin, midi, encas | végétarien |
| Börek (su böreği, sigara böreği) | Turquie | yufka (feuilles de pâte fine), fromage frais (beyaz peynir), persil, œufs, lait ou yaourt, beurre ou huile | monter en couches au four ou rouler en cigares frits | matin, encas | végétarien |
| Mercimek çorbası (shorbat adas) | Turquie, Liban, Syrie, Palestine, Jordanie, Égypte | lentilles corail, oignon, carotte, cumin, citron (au service), beurre ou huile | mijoter puis mixer, napper de beurre au piment (Turquie) | matin, midi, soir | végétarien |
| Ezogelin çorbası | Turquie | lentilles corail, boulgour fin, riz, concentré de tomate et de poivron, menthe séchée, piment | mijoter jusqu'à épaississement, parfumer à la menthe frite dans le beurre ou l'huile | midi, soir | végétarien |
| Tarhana çorbası | Turquie | tarhana (poudre fermentée de yaourt, farine et légumes), concentré de tomate, beurre, menthe séchée | délayer la tarhana à froid, mijoter en remuant | matin, midi, soir | végétarien |
| Mujaddara | Liban, Syrie, Palestine, Jordanie | lentilles brunes, riz ou boulgour, oignons, huile d'olive, cumin | cuire lentilles et céréale ensemble, frire les oignons jusqu'à caramélisation | midi, soir | vegan |
| Koshari | Égypte | riz, lentilles brunes, petites pâtes (vermicelles, coudes), pois chiches, sauce tomate vinaigrée à l'ail, oignons frits | cuire séparément les féculents, monter en couches, napper de sauce et d'oignons frits | midi, soir, encas | vegan |
| Tabbouleh | Liban, Syrie | persil plat (en grande quantité), boulgour fin, tomates, menthe, oignon nouveau, citron et huile d'olive | hacher finement le persil, assaisonner au citron | midi, soir | vegan |
| Fattoush | Liban, Syrie, Palestine | pain pita rassis grillé ou frit, laitue, tomates, concombre, radis, sumac, mélasse de grenade ou citron | griller le pain rassis, assaisonner au sumac | midi, soir | vegan |
| Kısır | Turquie | boulgour fin, concentré de tomate et de poivron, persil, oignon nouveau, citron ou mélasse de grenade, huile d'olive | gonfler le boulgour à l'eau chaude, pétrir avec les concentrés | midi, encas | vegan |
| Moutabal (baba ghanouj) | Liban, Syrie, Palestine, Jordanie, Israël | aubergines, tahini, ail, citron, huile d'olive | griller les aubergines à la flamme, écraser la chair fumée | midi, soir, encas | vegan |
| Salade israélienne (salat katzutz) | Israël, Palestine | tomates, concombres, oignon, persil, citron et huile d'olive | couper en tout petits dés | matin, midi, soir | vegan |
| Imam bayıldı | Turquie | aubergines, oignons, tomates, ail, persil, huile d'olive | frire les aubergines entières, farcir d'oignons fondus, cuire à l'étouffée, servir tiède | midi, soir | vegan |
| Taze fasulye zeytinyağlı (loubieh bi zeit) | Turquie, Liban, Syrie | haricots verts plats, tomates, oignon, ail (au Levant), huile d'olive | mijoter à l'étouffée dans l'huile d'olive, servir tiède ou froid | midi, soir | vegan |
| Kuru fasulye | Turquie | haricots blancs secs, oignon, concentré de tomate et de poivron, viande de bœuf ou pastırma (souvent), beurre ou huile | tremper la veille, mijoter longuement | midi, soir |  |
| Pilav (roz bi sh'arieh) | Turquie, Liban, Syrie, Égypte | riz, vermicelles (şehriye, sh'arieh), beurre ou huile, bouillon ou eau | dorer les vermicelles dans le beurre, cuire le riz par absorption | midi, soir | végétarien |
| Bulgur pilavı | Turquie | boulgour gros, oignon, tomate ou concentré, poivron vert, beurre ou huile | revenir l'oignon et la tomate, cuire le boulgour par absorption | midi, soir | végétarien |
| Yaprak sarma zeytinyağlı (warak enab bi zeit) | Turquie, Liban, Syrie, Palestine | feuilles de vigne, riz, oignon, herbes (persil, menthe), citron, huile d'olive | rouler serré les feuilles farcies, cuire à l'étouffée sous une assiette | midi, soir, encas | vegan |
| Mahshi kousa | Liban, Syrie, Palestine, Jordanie, Égypte | petites courgettes, riz, viande hachée, tomate (sauce) ou yaourt, menthe séchée et ail | évider les courgettes, farcir de riz cru et viande, mijoter dans la sauce | midi, soir |  |
| Karnıyarık | Turquie | aubergines, viande hachée, oignon, tomates, poivron vert, ail | frire les aubergines, fendre et farcir de viande, cuire au four | midi, soir |  |
| Mantı | Turquie | pâte (farine, œuf, eau), viande hachée et oignon, yaourt à l'ail, beurre au piment, menthe séchée | façonner de minuscules raviolis, pocher, napper de yaourt et de beurre pimenté | midi, soir |  |
| Köfte | Turquie | viande hachée (bœuf, agneau), oignon râpé, chapelure ou pain rassis, cumin, persil | pétrir la viande, façonner, griller ou poêler | midi, soir |  |
| Kafta bil sayniyeh | Liban, Syrie, Palestine, Jordanie | viande hachée, oignon et persil hachés, pommes de terre en rondelles, tomates, sept épices (baharat) | étaler la kafta dans un plat, couvrir de légumes, cuire au four | midi, soir |  |
| Kebbeh bil sayniyeh | Liban, Syrie | boulgour fin, viande maigre hachée (agneau ou bœuf), oignon, pignons, sept épices (baharat), beurre clarifié ou huile | pétrir boulgour et viande en pâte, monter en deux couches autour d'une farce, cuire au four | midi, soir |  |
| Bamia (ragoût de gombos) | Égypte, Irak, Liban, Syrie, Palestine | gombos, viande d'agneau ou de bœuf, tomates (concentré), ail, coriandre, citron | revenir la viande, mijoter avec les gombos et la tomate | midi, soir |  |
| Molokhia | Égypte, Liban, Syrie, Palestine, Jordanie | feuilles de corète (fraîches, hachées ou séchées), bouillon de poulet (ou lapin), ail, coriandre, riz ou pain (pour servir) | cuire les feuilles dans le bouillon, verser l'ail frit à la coriandre (taqliya) | midi, soir |  |
| Maqluba | Palestine, Jordanie, Syrie | riz, poulet ou agneau, aubergine frite, chou-fleur frit (ou pomme de terre), épices (baharat, curcuma) | monter en couches dans la marmite, cuire le riz par absorption, retourner sur le plat | midi |  |
| Musakhan | Palestine | poulet, pain taboon (ou pain plat), oignons, sumac, huile d'olive, pignons | fondre longuement les oignons au sumac, rôtir le poulet, imbiber le pain d'huile et le garnir | midi |  |
| Mansaf | Jordanie, Palestine | agneau, jameed (yaourt séché fermenté), riz, pain shrak, amandes ou pignons grillés | cuire l'agneau dans la sauce jameed, servir sur riz et pain | midi |  |
| Shish tawook | Liban, Syrie, Jordanie, Turquie (tavuk şiş) | blanc de poulet, yaourt, ail, citron, concentré de tomate ou paprika | mariner, griller en brochettes | midi, soir |  |
| Musaqa'a | Liban, Syrie | aubergines, pois chiches, tomates, oignon, ail, huile d'olive | frire ou rôtir les aubergines, mijoter avec tomate et pois chiches, servir tiède | midi, soir | vegan |
| Sayadieh | Liban, Syrie (côte), Palestine | poisson blanc, riz, oignons très caramélisés, cumin, pignons ou amandes | caraméliser les oignons, cuire le riz dans le bouillon d'oignons et de poisson | midi, soir |  |
| Samke harra | Liban, Syrie | poisson (entier ou filets), tahini, citron, ail, piment, coriandre et noix | cuire le poisson au four, napper de sauce tahini pimentée | midi, soir |  |
| Lahmacun | Turquie, Syrie (lahm bi ajeen) | pâte fine, viande hachée, tomates, oignon, poivron et piment, persil, citron (pour servir) | étaler une farce crue sur la pâte, cuire au four très chaud | midi, encas |  |
| Fatayer sabanekh | Liban, Syrie, Palestine, Jordanie | pâte à pain, épinards, oignon, sumac, citron, huile d'olive | dégorger les épinards au sel, fermer en triangles, cuire au four | matin, encas | vegan |
| Hawawshi | Égypte | pain baladi (pain rond), viande hachée, oignon, poivron et piment, épices | garnir le pain de viande crue assaisonnée, cuire au four | midi, encas |  |
| Shawarma | Liban, Syrie, Palestine, Jordanie, Israël, Turquie (döner) | poulet ou viande marinée en fines tranches, pain pita ou markouk, toum (crème d'ail) ou tahini, pickles, épices (cumin, cardamome, paprika) | mariner, griller ou rôtir les tranches de viande, rouler dans le pain | midi, soir, encas |  |
| Tashreeb | Irak | pain plat rassis (khubz), bouillon de poulet, d'agneau ou de haricots, pois chiches, oignon, loomi (citron séché) | mijoter le bouillon, le verser sur le pain déchiré | midi, soir |  |
| Dolma irakienne | Irak | feuilles de vigne, oignons, courgettes, aubergines et poivrons évidés, riz, viande hachée, tomate, mélasse de grenade ou citron | farcir les légumes et rouler les feuilles, cuire serrés dans une marmite | midi, soir |  |
| Roz bel laban (sütlaç) | Égypte, Liban, Syrie, Turquie | riz, lait, sucre, eau de rose ou de fleur d'oranger (Levant), vanille ou cannelle (Turquie) | cuire le riz dans le lait en remuant, servir frais (gratiné au four pour le fırın sütlaç) | encas | végétarien |
| Ma'amoul | Liban, Syrie, Palestine, Jordanie, Égypte | semoule (et farine), beurre clarifié, dattes, noix ou pistaches, eau de rose ou de fleur d'oranger | sabler la semoule au beurre, farcir et mouler, cuire au four | encas, matin | végétarien |

<a id="france"></a>

## France (60 plats)

| Plat | Pays | Ingrédients essentiels | Techniques | Moments | Régime |
|---|---|---|---|---|---|
| Tartines beurre-confiture | France | pain (baguette, pain de campagne, rassis grillé possible), beurre, confiture ou miel | griller le pain (facultatif), tartiner | matin, encas | végétarien |
| Pain perdu | France | pain rassis (ou brioche), lait, œufs, sucre, beurre | tremper le pain dans le mélange lait-œufs, dorer au beurre à la poêle | matin, encas | végétarien |
| Crêpes | France (Bretagne d'origine, tout le pays) | farine de blé, œufs, lait, beurre, sucre, confiture ou pâte à tartiner (garniture) | laisser reposer la pâte, cuire fines à la poêle | matin, encas, soir | végétarien |
| Œufs à la coque et mouillettes | France | œufs, pain, beurre, sel | cuire 3 minutes à l'eau bouillante, couper le pain beurré en bâtonnets | matin, soir | végétarien |
| Gâteau au yaourt | France | yaourt nature (le pot sert de mesure), farine, sucre, œufs, huile, levure chimique | mélanger au pot de yaourt, cuire au four | matin, encas | végétarien |
| Quatre-quarts | France (Bretagne) | œufs, beurre (demi-sel en Bretagne), sucre, farine (même poids pour les quatre) | peser les œufs pour doser le reste, cuire au four | matin, encas | végétarien |
| Pain d'épices | France (Bourgogne, Alsace, Reims) | miel, farine (seigle ou blé), épices (cannelle, anis, gingembre, girofle), lait, bicarbonate ou levure | chauffer le miel avec le lait, cuire longuement à four doux | matin, encas | végétarien |
| Kouglof | France (Alsace) | farine, levure de boulanger, beurre, œufs, lait, raisins secs et amandes | pétrir une pâte briochée, cuire dans un moule à kouglof | matin, encas | végétarien |
| Madeleines | France (Lorraine) | œufs, sucre, farine, beurre fondu, zeste de citron ou miel, levure chimique | refroidir la pâte, cuire à four chaud dans des moules à coquilles | encas, matin | végétarien |
| Gaufres | France (Nord), Belgique | farine, œufs, lait, beurre, sucre, levure | cuire dans un gaufrier | encas | végétarien |
| Far breton | France (Bretagne) | lait, œufs, farine, sucre, beurre, pruneaux (souvent) | mélanger une pâte liquide, cuire au four | encas | végétarien |
| Clafoutis aux cerises | France (Limousin) | cerises (ou autres fruits), œufs, lait, farine, sucre, beurre | napper les fruits d'une pâte à flan, cuire au four | encas | végétarien |
| Riz au lait | France (dont la teurgoule en Normandie) | riz rond, lait entier, sucre, vanille ou cannelle | cuire doucement le riz dans le lait (ou au four, pour la teurgoule) | encas | végétarien |
| Compote de pommes | France | pommes (abîmées possibles), un peu d'eau, sucre (facultatif), cannelle ou vanille (facultatif) | cuire les fruits en morceaux à couvert, écraser ou mixer | encas, matin | vegan |
| Tarte aux pommes | France | pâte brisée ou sablée, pommes, sucre, beurre, compote (en fond, souvent) | foncer le moule, disposer les pommes en rosace, cuire au four | encas | végétarien |
| Soupe de légumes (potage) | France | légumes de saison (poireau, carotte, pomme de terre, navet, courge), oignon, beurre ou crème (facultatif), eau ou bouillon | mijoter les légumes, mixer ou laisser en morceaux | soir | végétarien |
| Soupe à l'oignon gratinée | France (Paris, Lyon) | oignons, beurre, bouillon (bœuf ou volaille), pain rassis, fromage râpé (comté, gruyère) | caraméliser longuement les oignons, gratiner au four avec pain et fromage | soir |  |
| Pot-au-feu | France | bœuf à bouillir (paleron, plat de côtes, jarret), os à moelle, carottes, poireaux, navets, oignon piqué de clous de girofle | pocher longuement la viande, ajouter les légumes en cours de cuisson, servir le bouillon à part | midi, soir |  |
| Hachis parmentier | France | viande cuite hachée (restes de pot-au-feu ou bœuf haché), pommes de terre en purée, oignon, beurre et lait, fromage râpé (facultatif) | monter en couches viande puis purée, gratiner au four | midi, soir |  |
| Blanquette de veau | France | veau (tendron, épaule), carottes, champignons de Paris, oignons, crème, jaune d'œuf et citron | pocher la viande dans un bouillon aromatique, lier la sauce au roux, à la crème et au jaune | midi, soir |  |
| Bœuf bourguignon | France (Bourgogne) | bœuf à braiser (paleron, joue), vin rouge, lardons, champignons, petits oignons, carottes | mariner (facultatif), dorer la viande, mijoter plusieurs heures au vin | midi, soir |  |
| Coq au vin | France (Bourgogne) | coq ou poulet en morceaux, vin rouge, lardons, champignons, petits oignons | dorer la volaille, mijoter au vin, lier la sauce | midi, soir |  |
| Poulet rôti | France | poulet entier, beurre, ail, thym, pommes de terre (en accompagnement) | rôtir au four en arrosant, déglacer les sucs pour le jus | midi |  |
| Poule au pot | France (Béarn, Sud-Ouest) | poule, farce (pain rassis, jambon, foies, œuf, ail, persil), carottes, poireaux, navets, riz ou vermicelles (pour le bouillon) | farcir la volaille, pocher longuement avec les légumes | midi |  |
| Navarin d'agneau | France | agneau (épaule, collier), carottes, navets, petits pois, pommes de terre, tomate et bouquet garni | dorer la viande, mijoter en ragoût avec les légumes de printemps | midi, soir |  |
| Lapin à la moutarde | France | lapin en morceaux, moutarde de Dijon, crème, vin blanc, échalotes, thym | badigeonner de moutarde, dorer puis mijoter, lier à la crème | midi, soir |  |
| Petit salé aux lentilles | France (Auvergne, Centre) | lentilles vertes (du Puy), petit salé (poitrine ou palette de porc demi-sel), saucisse (souvent), carotte, oignon | dessaler la viande, mijoter avec les lentilles | midi, soir |  |
| Tomates farcies | France (Provence et tout le pays) | tomates, chair à saucisse ou restes de viande hachée, pain rassis ou riz, oignon et ail, persil | évider les tomates, farcir, cuire au four, souvent sur un lit de riz | midi, soir |  |
| Gratin dauphinois | France (Dauphiné) | pommes de terre, lait, crème, ail, muscade | trancher finement sans rincer, cuire lentement au four | midi, soir | végétarien |
| Endives au jambon | France (Nord), Belgique | endives, jambon blanc, béchamel, fromage râpé | braiser les endives, rouler dans le jambon, gratiner sous béchamel | midi, soir |  |
| Carbonade flamande | France (Nord), Belgique | bœuf à braiser, bière brune, oignons, pain d'épices tartiné de moutarde, cassonade, thym et laurier | dorer la viande, mijoter longuement à la bière | midi, soir |  |
| Moules marinières | France (Nord, Normandie, Bretagne, Charente) | moules, vin blanc, échalotes, persil, beurre, frites (en accompagnement, dans le Nord) | cuire à couvert à feu vif jusqu'à ouverture | midi, soir |  |
| Quiche lorraine | France (Lorraine) | pâte brisée, lardons, œufs, crème, lait, muscade | foncer le moule, verser l'appareil œufs-crème, cuire au four | midi, soir |  |
| Flamiche aux poireaux | France (Picardie, Nord) | poireaux, pâte brisée ou feuilletée, œufs, crème, beurre | fondre les poireaux au beurre, cuire en tourte ou tarte au four | midi, soir | végétarien |
| Omelette aux fines herbes | France | œufs, fines herbes (ciboulette, persil, cerfeuil), beurre | battre les œufs, cuire baveuse et rouler | midi, soir | végétarien |
| Croque-monsieur | France | pain de mie, jambon blanc, fromage râpé (emmental, comté), beurre, béchamel (facultatif) | garnir les tranches, dorer à la poêle, au four ou à l'appareil | midi, soir, encas |  |
| Poireaux vinaigrette | France | poireaux, moutarde, vinaigre, huile, échalote | cuire les poireaux à l'eau, napper de vinaigrette tiède | midi, soir | vegan |
| Ratatouille | France (Provence, Nice) | aubergines, courgettes, poivrons, tomates, oignons, ail, thym et huile d'olive | revenir chaque légume séparément, mijoter ensemble | midi, soir | vegan |
| Tian provençal | France (Provence) | courgettes, tomates, aubergines, oignon, herbes de Provence, huile d'olive | disposer les légumes en rondelles alternées, cuire longuement au four | midi, soir | vegan |
| Soupe au pistou | France (Provence) | haricots (blancs, rouges, verts), courgettes, pommes de terre, petites pâtes, pistou (basilic, ail, huile d'olive, parmesan ou gruyère) | mijoter les légumes et haricots, ajouter le pistou hors du feu | midi, soir | végétarien |
| Daube provençale | France (Provence) | bœuf à braiser, vin rouge, zeste d'orange, carottes et oignons, ail, herbes de Provence, olives noires (souvent) | mariner la viande au vin, mijoter très longuement | midi, soir |  |
| Brandade de morue | France (Nîmes, Languedoc, Provence) | morue dessalée, huile d'olive, lait, ail, pommes de terre (version ménagère) | pocher la morue, monter en émulsion avec huile et lait, gratiner (facultatif) | midi, soir |  |
| Salade niçoise | France (Nice) | tomates, œufs durs, thon ou anchois, olives noires, poivron, oignon nouveau, radis, huile d'olive | assembler en salade composée | midi, soir |  |
| Pissaladière | France (Nice) | pâte à pain, oignons fondus, anchois (ou pissalat), olives noires | fondre longuement les oignons, cuire au four sur la pâte | encas, midi |  |
| Socca | France (Nice) | farine de pois chiches, eau, huile d'olive, sel et poivre | cuire en couche très fine à four très chaud | encas | vegan |
| Bouillabaisse | France (Marseille) | poissons de roche variés, tomates, oignon, fenouil, ail, safran, huile d'olive, rouille et croûtons | bouillir vivement pour émulsionner, servir le bouillon puis les poissons | midi |  |
| Cassoulet | France (Castelnaudary, Toulouse, Carcassonne) | haricots blancs (lingots), confit de canard, saucisse de Toulouse, porc (couenne, épaule), ail, tomate (selon la version) | mijoter les haricots, cuire longuement au four en cassant la croûte | midi |  |
| Garbure | France (Béarn, Gascogne) | chou, haricots, pommes de terre, carottes, navets, poireaux, confit ou jambon (os de jambon) | mijoter longuement une soupe épaisse | midi, soir |  |
| Piperade | France (Pays basque) | poivrons, tomates, oignons, ail, piment d'Espelette, œufs (souvent brouillés dedans) ou jambon de Bayonne | fondre les légumes à l'huile, mijoter | midi, soir | végétarien |
| Axoa | France (Pays basque) | veau haché ou coupé au couteau, piments doux ou poivrons, oignons, piment d'Espelette, ail | fondre les légumes, mijoter la viande avec | midi, soir |  |
| Choucroute garnie | France (Alsace) | chou fermenté (choucroute), saucisses (Strasbourg, Montbéliard), lard et porc salé ou fumé, pommes de terre, vin blanc, baies de genièvre | rincer et braiser la choucroute, cuire les viandes dessus | midi, soir |  |
| Tarte flambée (flammekueche) | France (Alsace) | pâte à pain très fine, fromage blanc et crème, oignons, lardons | étaler très finement, cuire quelques minutes à four très chaud | soir, encas |  |
| Baeckeoffe | France (Alsace) | trois viandes (bœuf, porc, agneau), pommes de terre, oignons, poireaux, carottes, vin blanc d'Alsace | mariner les viandes au vin, cuire en terrine lutée plusieurs heures au four | midi |  |
| Galette complète | France (Bretagne) | farine de sarrasin (blé noir), eau, sel, œuf, jambon, fromage râpé | laisser reposer la pâte, cuire sur une crêpière (bilig), garnir et replier | midi, soir |  |
| Kig ha farz | France (Bretagne, Léon) | farine de sarrasin (farz), jarret et lard de porc, bœuf, chou, carottes, navets, poireaux | cuire le farz en sac dans le bouillon, pocher viandes et légumes | midi |  |
| Tartiflette | France (Savoie, Haute-Savoie) | pommes de terre, reblochon, lardons, oignons, crème (facultatif) | revenir pommes de terre, lardons et oignons, gratiner au four sous le reblochon | soir, midi |  |
| Aligot | France (Aubrac, Auvergne) | pommes de terre, tome fraîche de l'Aubrac (ou tome de Cantal), crème, beurre, ail | écraser en purée, incorporer la tome en filant énergiquement | midi, soir | végétarien |
| Truffade | France (Auvergne) | pommes de terre, tome fraîche de Cantal, ail, lard ou graisse de porc | rissoler les pommes de terre en tranches, faire fondre la tome dedans | midi, soir |  |
| Salade lyonnaise | France (Lyon) | frisée (ou pissenlit), lardons, croûtons de pain, œuf poché, vinaigrette moutardée | rissoler lardons et croûtons, déglacer au vinaigre, pocher l'œuf | midi, soir |  |
| Cervelle de canut | France (Lyon) | fromage blanc, échalote, ciboulette et fines herbes, ail, huile et vinaigre | battre le fromage blanc avec les herbes | encas, soir | végétarien |
