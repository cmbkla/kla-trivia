import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { ChatComponent } from './chat/chat.component';
import { HostComponent } from './host/host.component';
import { DisplayComponent } from './display/display.component';

const routes: Routes = [
  { path: '', component: ChatComponent },
  { path: 'host', component: HostComponent },
  { path: 'display', component: DisplayComponent }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
