import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent, IonFooter } from '@ionic/angular';
import { TripItem } from '../../../core/models/models';
import { ClientService } from '../../../core/services/client.service';
import { dateLabel, money } from '../../../core/utils/format';
import { ClientTabsComponent } from '../../../shared/components/client-tabs.component';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [IonContent, IonFooter, RouterLink, ClientTabsComponent],
  templateUrl: './history.page.html',
})
export class HistoryPage {
  private client = inject(ClientService);
  trips = signal<TripItem[]>([]);
  loading = signal(true);
  money = money;
  dateLabel = dateLabel;

  ionViewWillEnter(): void {
    this.loading.set(true);
    this.client.trips().subscribe({
      next: (t) => {
        this.trips.set(t);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}