import { Component, OnInit, ViewEncapsulation, HostListener } from '@angular/core';
import { COUNTRIES as COUNTRY_DATA, type Country } from './app-data';

type Guess = {
  c: Country;
  dist: number;
  correct: boolean;
};

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrls: ['./app.css'],
  encapsulation: ViewEncapsulation.None
})
export class App implements OnInit {
  readonly COUNTRIES: Country[] = COUNTRY_DATA;

  readonly REGIONS = ['World', 'Europe', 'Middle East', 'Asia', 'Africa', 'Americas', 'Oceania'];
  readonly MAX_GUESS = 6;

  G = {
    region: 'World',
    target: null as Country | null,
    guesses: [] as Guess[],
    revealed: 0,
    hiddenTiles: [] as number[],
    done: false,
    acIdx: -1,
    sessionUsed: new Set<string>(),
    stats: { correct: 0, played: 0, totalGuesses: 0, streak: 0, bestStreak: 0 }
  };

  readonly tileIndexes = [0, 1, 2, 3, 4, 5];
  flagImageUrl = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
  countryInput = '';

  ngOnInit(): void {
    this.newRound();
    this.updateStats();
  }
  filteredCountries: Country[] = [];
  resultVisible = false;
  resultTitle = '';
  toastVisible = false;
  toastMessage = '';
  avgGuessDisplay = '—';
  revealedTileIndexes: number[] = [];

  private deg2rad(d: number): number {
    return (d * Math.PI) / 180;
  }
  
  @HostListener('document:click', ['$event'])
  onClickOutside(event: Event): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.autocomplete-wrap')) {
      this.closeAC();
    }
  }
  private haversine(a: number, b: number, c: number, d: number): number {
    const R = 6371;
    const dLat = this.deg2rad(c - a);
    const dLon = this.deg2rad(d - b);
    return Math.round(
      2 *
        R *
        Math.asin(
          Math.sqrt(
            Math.sin(dLat / 2) ** 2 +
              Math.cos(this.deg2rad(a)) *
                Math.cos(this.deg2rad(c)) *
                Math.sin(dLon / 2) ** 2
          )
        )
    );
  }

  private normalize(value: string): string {
    return value.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  private toast(msg: string, dur = 2200): void {
    this.toastMessage = msg;
    this.toastVisible = true;
    setTimeout(() => {
      this.toastVisible = false;
    }, dur);
  }

  private emojiToIso(emoji: string): string {
    return Array.from(emoji)
      .map((char) => String.fromCodePoint(char.codePointAt(0)! - 127397).toLowerCase())
      .join('');
  }

  private renderFlag(target: Country): void {
    const iso = this.emojiToIso(target.e);
    this.flagImageUrl = `https://flagcdn.com/w640/${iso}.png`;
  }

  private clearFlag(): void {
    this.flagImageUrl = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
  }

  private revealTile(index: number): void {
    if (!this.revealedTileIndexes.includes(index)) {
      this.revealedTileIndexes = [...this.revealedTileIndexes, index];
    }
  }

  private revealAll(): void {
    this.revealedTileIndexes = [0, 1, 2, 3, 4, 5];
  }

  private getPool(): Country[] {
    return this.G.region === 'World'
      ? this.COUNTRIES
      : this.COUNTRIES.filter((country) => country.r === this.G.region);
  }

  private pickTarget(): Country {
    const pool = this.getPool();
    let available = pool.filter((country) => !this.G.sessionUsed.has(country.n));

    if (!available.length) {
      this.G.sessionUsed.clear();
      available = [...pool];
    }

    for (let i = available.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [available[i], available[j]] = [available[j], available[i]];
    }

    return available[0];
  }

  selectRegion(region: string): void {
    if (this.G.region === region) return;
    this.G.region = region;
    this.G.sessionUsed.clear();
    this.newRound();
  }

  newRound(): void {
    this.revealedTileIndexes = [];
    this.clearFlag();

    this.G.guesses = [];
    this.G.revealed = 0;
    this.G.hiddenTiles = [0, 1, 2, 3, 4, 5];
    this.G.done = false;
    this.G.acIdx = -1;
    this.G.target = this.pickTarget();
    this.G.sessionUsed.add(this.G.target.n);

    // Wait 80ms to let the UI repaint with covered tiles before loading the new flag.
    // This perfectly prevents peeking at the next round's flag.
    setTimeout(() => {
      if (this.G.target) {
        this.renderFlag(this.G.target);
      }
    }, 80);

    this.resultVisible = false;
    this.countryInput = '';
    this.filteredCountries = [];
    this.closeAC();
  }

  submitGuess(): void {
    if (this.G.done || !this.G.target) return;

    const value = this.countryInput.trim();
    if (!value) return;

    const match = this.COUNTRIES.find((country) => this.normalize(country.n) === this.normalize(value));
    if (!match) {
      this.toast('Country not found — pick from the list.');
      return;
    }

    if (this.G.guesses.some((guess) => guess.c.n === match.n)) {
      this.toast('Already guessed!');
      return;
    }

    const correct = match.n === this.G.target.n;
    const dist = this.haversine(match.lat, match.lon, this.G.target.lat, this.G.target.lon);

    this.G.guesses.push({ c: match, dist, correct });

    this.countryInput = '';
    this.closeAC();

    if (!correct && this.G.hiddenTiles.length > 0) {
      const revealIndex = Math.floor(Math.random() * this.G.hiddenTiles.length);
      const tileToReveal = this.G.hiddenTiles.splice(revealIndex, 1)[0];
      this.revealTile(tileToReveal);
      this.G.revealed++;
    }

    if (correct) {
      this.G.done = true;
      this.G.stats.correct++;
      this.G.stats.played++;
      this.G.stats.totalGuesses += this.G.guesses.length;
      this.G.stats.streak += 1;
      this.G.stats.bestStreak = Math.max(this.G.stats.bestStreak, this.G.stats.streak);
      this.revealAll();
      this.showResult(true);
      this.updateStats();
      return;
    }

    if (this.G.guesses.length >= this.MAX_GUESS) {
      this.G.done = true;
      this.G.stats.played++;
      this.G.stats.totalGuesses += this.MAX_GUESS;
      this.G.stats.streak = 0;
      this.revealAll();
      this.showResult(false);
      this.updateStats();
    }
  }

  private showResult(won: boolean): void {
    if (!this.G.target) return;

    this.resultTitle = won ? `${this.G.target.n} ${this.G.target.e}` : `The answer was: ${this.G.target.n} ${this.G.target.e}`;
    this.resultVisible = true;
  }

  private updateStats(): void {
    const stats = this.G.stats;
    this.avgGuessDisplay = stats.played ? (stats.totalGuesses / stats.played).toFixed(1) : '—';
  }

  onCountryInput(value: string): void {
    this.countryInput = value;
    if (!value.trim()) {
      this.onInputFocus();
    } else {
      this.buildAC(value);
    }
  }

  selectCountry(country: Country): void {
    this.countryInput = country.n;
    this.onCountryInput(country.n);
    this.closeAC();
    this.submitGuess();
  }

  closeAC(): void {
    this.filteredCountries = [];
    this.G.acIdx = -1;
  }

  onInputBlur(): void {
    setTimeout(() => this.closeAC(), 160);
  }

  onInputFocus(): void {
    if (!this.countryInput.trim()) {
      const pool = [...this.getPool()];
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      this.filteredCountries = pool.slice(0, 15);
      this.G.acIdx = -1;
    }
  }

  private buildAC(value: string): void {
    const normalizedValue = this.normalize(value);

    if (!normalizedValue) {
      this.onInputFocus();
      return;
    }

    const pool = this.COUNTRIES;

    // 1. Exact or prefix matches on full name
    const prefixMatches = pool.filter((country) =>
      this.normalize(country.n).startsWith(normalizedValue)
    ).sort((a, b) => a.n.localeCompare(b.n));

    // 2. Word-start matches or substring matches
    const substringMatches = pool.filter((country) => {
      const normName = this.normalize(country.n);
      return !normName.startsWith(normalizedValue) && normName.includes(normalizedValue);
    }).sort((a, b) => a.n.localeCompare(b.n));

    const matches = [...prefixMatches, ...substringMatches];

    if (!matches.length) {
      this.closeAC();
      return;
    }

    this.filteredCountries = matches;
    this.G.acIdx = -1;
  }

  acNav(direction: number): void {
    if (!this.filteredCountries.length) return;
    this.G.acIdx = Math.max(0, Math.min(this.filteredCountries.length - 1, this.G.acIdx + direction));
    this.countryInput = this.filteredCountries[this.G.acIdx].n;
  }
}


