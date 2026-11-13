import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent, IonFooter } from '@ionic/angular';
import { Incident } from '../../../core/models/admin.models';
import { AdminService } from '../../../core/services/admin.service';
import { AdminTabsComponent } from '../../../shared/components/admin-tabs.component';

@Component({
  selector: 'app-complaints',
  standalone: true,
  imports: [IonContent, IonFooter, RouterLink, AdminTabsComponent],
  templateUrl: './complaints.page.html',
})
export class ComplaintsPage {
  private admin = inject(AdminService);

  filter = signal<'pending' | 'resolved'>('pending');
  incidents = signal<Incident[]>([]);
  resolved = signal<string[]>([]);
  loading = signal(true);
  failed = signal(false);

  shown = computed(() =>
    this.incidents().filter((i) => this.resolved().includes(i.key) === (this.filter() === 'resolved')),
  );

  ionViewWillEnter(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.failed.set(false);
    this.resolved.set(this.admin.resolvedKeys());
    this.admin.dashboard().subscribe({
      next: (r) => {
        this.incidents.set(r.incidents);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.failed.set(true);
      },
    });
  }

  isResolved(key: string): boolean {
    return this.resolved().includes(key);
  }
}