import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
  MatButtonModule,
  MatCardModule,
  MatDialog,
  MatDialogModule, MatExpansionModule,
  MatIconModule,
  MatInputModule,
  MatListModule,
  MatRadioModule
} from '@angular/material';

import { DisplayComponent } from './display.component';
import { SocketService } from '../shared/socket.service';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatDialogModule,
    MatIconModule,
    MatInputModule,
    MatListModule,
    MatRadioModule,
    ReactiveFormsModule
  ],
  declarations: [DisplayComponent],
  providers: [MatDialog, SocketService],
  entryComponents: [DisplayComponent]
})
export class DisplayModule { }
