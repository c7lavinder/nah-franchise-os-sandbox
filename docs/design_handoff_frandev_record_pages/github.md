repo: NewAgainHouses/mastersuite
branch: main
path: apps/analysis-api/MasterSuite/Pages

## Last sync

date: 2026-08-03T21:21:48Z

### Updated in this project

- Recreated the seven Gunner/FranDev detail screens as Design Components at true scale (no 0.82 page zoom).
- Copied the repo's Font Awesome 4.7 stylesheet and webfonts so the rail, pencils and chrome icons are the real icon set.
- Applied the gunner.css module tier consistently: Hanken Grotesk, one card recipe, one section-label style, one badge palette.
- Rebuilt KPI, field-row and rail-count typography into a single hierarchy (tabular numbers, dimmed empty values, dimmed unwired rail sections).
- Chrome (MasterSuite header bar, .ghead card, tab strip, nine-section rail, stage bar) recreated from the shared partials.

## Screen map

| Screen                     | Built from                                                                                                                 |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Gunner Buyer.dc.html       | Pages/Gunner/BuyerDetail.cshtml, \_GunnerContactStyles.cshtml, ShellStyles/\_PersonPage.cshtml, \_GunnerContactRail.cshtml |
| Gunner Seller.dc.html      | Pages/Gunner/SellerDetail.cshtml, \_GunnerContactStyles.cshtml, \_GunnerContactRail.cshtml                                 |
| Gunner Partner.dc.html     | Pages/Gunner/PartnerDetail.cshtml, \_GunnerContactStyles.cshtml, \_GunnerContactRail.cshtml                                |
| Frandev Prospect.dc.html   | Pages/Frandev/ContactV2.cshtml                                                                                             |
| Frandev Franchisee.dc.html | Pages/Frandev/ContactV2.cshtml (franchisee state)                                                                          |
| Frandev Journey.dc.html    | Pages/Frandev/JourneyV2.cshtml, ShellStyles/\_StageBar.cshtml                                                              |
| Frandev Territory.dc.html  | Pages/Frandev/TerritoryV2.cshtml, ShellStyles/\_ContactTiles.cshtml                                                        |
| MSHeader.dc.html           | Pages/Gunner/HeaderBar.cshtml, \_GunnerHeader.cshtml, assets/css/platform/custom.scss                                      |

## Copied assets

- assets/MasterSuite.svg ← wwwroot/assets-v1/img/logos/MasterSuite.svg
- assets/css/vendor/font-awesome.min.css + assets/css/fonts/fontawesome-webfont.woff2|woff|ttf ← wwwroot/assets/css/

## Shared style sources

- wwwroot/css/gunner.css — module tokens (ink #1B2430, muted #7A828F, line #E6E9ED, accent #00A1E1, radius 14/9), badge + grade palettes, Hanken Grotesk.
- Pages/Gunner/ShellStyles/\_Header.cshtml, \_Rail1.cshtml, \_Rail2.cshtml, \_Tabs.cshtml, \_StageBar.cshtml, \_ContactTiles.cshtml, \_PersonPage.cshtml.
- Helpers/Constants.cs — PropertyPageSidebarGridCssClass / PropertyPageContentGridCssClass (rail right, content left).
