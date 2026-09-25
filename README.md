# MT Risicosimulatie – eerste werkende versie

Deze map kan direct op GitHub Pages worden gepubliceerd.

## Gebruik
1. Upload alle bestanden en mappen naar een GitHub repository.
2. Zet GitHub Pages aan voor de `main` branch / root.
3. Open de gepubliceerde URL.
4. De spelstatus wordt lokaal in de browser opgeslagen via `localStorage`.

## Database
`data/game-data.json` is gegenereerd uit `Database_MT_risicosimulatie_v2.xlsx` en bevat scenario's, besluiteffecten, routekaart, condities en configuratie.

## Werking
- Vier MT's worden naast elkaar gevolgd.
- Per MT wordt A/B/C/D door de docent ingevoerd.
- Scores worden automatisch aangepast.
- Keuze C voegt het risico toe aan de lijst actieve MT-risico's.
- Na alle vier keuzes activeert `Volgende ronde` het vervolgscenario volgens de routekaart.
- Na R1.4 start automatisch risicolijn 2, daarna 3 en 4.
- `Ongedaan maken` herstelt de laatste actie binnen de huidige browsersessie.

Dit is bewust een eerste functionele versie. Visuele verfijning en uitgebreidere spelstatuslogica kunnen hierna worden toegevoegd.
