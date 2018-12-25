import { Component, OnInit, ViewChild, NgZone, Inject, OnDestroy } from '@angular/core';
import { ModalSelectServicepointsComponent } from 'src/app/shared/modal-select-servicepoints/modal-select-servicepoints.component';
import { QueueService } from 'src/app/shared/queue.service';
import { AlertService } from 'src/app/shared/alert.service';
import * as mqttClient from '../../../vendor/mqtt';
import { MqttClient } from 'mqtt';
import * as _ from 'lodash';
import * as Random from 'random-js';
import { Howl, Howler } from 'howler';

import { CountdownComponent } from 'ngx-countdown';
import { Router } from '@angular/router';
import { JwtHelperService } from '@auth0/angular-jwt';

@Component({
  selector: 'app-display-queue',
  templateUrl: './display-queue.component.html',
  styles: [
    `
    .main-panel {
        transition: width 0.25s ease, margin 0.25s ease;
        width: 100%;
        min-height: calc(100vh - 70px);
        display: flex;
        flex-direction: column;
    }

    .table-striped tbody tr:nth-of-type(odd) {
        background-color: #0d47a1;
        color: white;
    }

    .bg-primary, .settings-panel .color-tiles .tiles.primary {
        background-color: #0d47a1 !important;
    }

    .bg-blue, .settings-panel .color-tiles .tiles.danger {
        background-color: #1a237e !important;
    }

    `

  ]
})
export class DisplayQueueComponent implements OnInit, OnDestroy {

  ngOnInit(): void { }

  @ViewChild('mdlServicePoint') private mdlServicePoint: ModalSelectServicepointsComponent;
  @ViewChild(CountdownComponent) counter: CountdownComponent;

  jwtHelper = new JwtHelperService();
  servicePointTopic = null;

  servicePointId: any;
  servicePointName: any;
  workingItems: any = [];
  currentQueueNumber: any;
  currentRoomNumber: any;
  currentHn: any;
  currentRoomName: any;
  currentTopic: any = '';

  isOffline = false;

  client: MqttClient;
  notifyUser = null;
  notifyPassword = null;

  isSound = false;

  isPlayingSound = false;
  playlists: any = [];
  notifyUrl: string;

  constructor(
    private queueService: QueueService,
    private alertService: AlertService,
    private zone: NgZone,
    private router: Router
  ) {
    const token = sessionStorage.getItem('token');
    const decodedToken = this.jwtHelper.decodeToken(token);
    this.servicePointTopic = decodedToken.SERVICE_POINT_TOPIC;

    this.notifyUrl = `ws://${decodedToken.NOTIFY_SERVER}:${+decodedToken.NOTIFY_PORT}`;
    this.notifyUser = decodedToken.NOTIFY_USER;
    this.notifyPassword = decodedToken.NOTIFY_PASSWORD;
  }

  public unsafePublish(topic: string, message: string): void {
    try {
      this.client.end(true);
    } catch (error) {
      console.log(error);
    }
  }

  public ngOnDestroy() {
    try {
      this.client.end(true);
    } catch (error) {
      console.log(error);
    }
  }

  toggleSound() {
    this.isSound = !this.isSound;
  }

  prepareSound() {
    console.log(this.playlists.length);
    if (!this.isPlayingSound) {
      if (this.playlists.length) {
        var queueNumber = this.playlists[0].queueNumber;
        var roomNumber = this.playlists[0].roomNumber;
        this.playSound(queueNumber, roomNumber);
      }
    }
  }

  playSound(strQueue: string, strRoomNumber: string) {

    this.isPlayingSound = true;

    var _strQueue = strQueue.split('');
    var _strRoom = strRoomNumber.split('');

    var audioFiles = [];

    audioFiles.push('./assets/audio/number.mp3')
    audioFiles.push('./assets/audio/silent.mp3')

    _strQueue.forEach(v => {
      audioFiles.push(`./assets/audio/${v}.mp3`);
    });

    audioFiles.push('./assets/audio/silent.mp3');
    audioFiles.push('./assets/audio/please.mp3');
    audioFiles.push('./assets/audio/at.mp3');
    audioFiles.push('./assets/audio/channel.mp3');
    audioFiles.push('./assets/audio/service.mp3');

    _strRoom.forEach(v => {
      audioFiles.push(`./assets/audio/${v}.mp3`);
    });

    audioFiles.push('./assets/audio/ka.mp3');

    var howlerBank = [];

    // console.log(audioFiles);

    var loop = false;

    var onPlay = [false], pCount = 0;
    const that = this;

    var onEnd = function (e) {

      if (loop === true) {
        pCount = (pCount + 1 !== howlerBank.length) ? pCount + 1 : 0;
      } else {
        pCount = pCount + 1;
      }

      if (pCount <= audioFiles.length - 1) {
        howlerBank[pCount].play();
      } else {
        this.isPlayingSound = false;
        // remove queue in playlist
        const idx = _.findIndex(that.playlists, { queueNumber: strQueue, roomNumber: strRoomNumber });
        if (idx > -1) that.playlists.splice(idx, 1);
        // call sound again
        setTimeout(() => {
          that.isPlayingSound = false;
          that.prepareSound();
        }, 1000)
      }
    };

    audioFiles.forEach(function (current, i) {
      howlerBank.push(new Howl({
        src: [audioFiles[i]],
        onend: onEnd,
        preload: true,
        html5: true,
      }));
    });

    howlerBank[0].play();

  }

  logout() {
    sessionStorage.removeItem('token');
    this.router.navigate(['/login']);
  }

  connectWebSocket() {
    const rnd = new Random();
    const username = sessionStorage.getItem('username');
    const strRnd = rnd.integer(1111111111, 9999999999);
    const clientId = `${username}-${strRnd}`;

    this.client = mqttClient.connect(this.notifyUrl, {
      clientId: clientId,
      username: this.notifyUser,
      password: this.notifyPassword
    });

    const topic = `${this.servicePointTopic}/${this.servicePointId}`;

    const that = this;

    this.client.on('message', (topic, payload) => {

      // this.getWorking();
      that.getCurrentQueue();

      const _payload = JSON.parse(payload.toString());
      if (that.isSound) {
        if (that.servicePointId === +_payload.servicePointId) {
          // play sound
          const sound = { queueNumber: _payload.queueNumber, roomNumber: _payload.roomNumber.toString() };
          that.playlists.push(sound);
          that.prepareSound();
        }
      }

    });

    this.client.on('connect', () => {
      that.zone.run(() => {
        that.isOffline = false;
      });

      that.client.subscribe(topic, (error) => {
        if (error) {
          that.zone.run(() => {
            that.isOffline = true;
            try {
              that.counter.restart();
            } catch (error) {
              console.log(error);
            }
          });
        }
      });
    });

    this.client.on('close', () => {
      console.log('MQTT Conection Close');
    });

    this.client.on('error', (error) => {
      console.log('MQTT Error');
      that.zone.run(() => {
        that.isOffline = true;
        that.counter.restart();
      });
    });

    this.client.on('offline', () => {
      console.log('MQTT Offline');
      that.zone.run(() => {
        that.isOffline = true;
        try {
          that.counter.restart();
        } catch (error) {
          console.log(error);
        }
      });
    })
  }

  selectServicePoint() {
    this.mdlServicePoint.open();
  }

  onSelectedPoint(event: any) {
    console.log(event);
    // set service info
    this.servicePointName = event.service_point_name;
    this.servicePointId = event.service_point_id;
    this.currentTopic = event.topic;

    // connect mqtt
    this.connectWebSocket();
    // get list
    // this.getWorking();
    this.getCurrentQueue();
  }

  // async getWorking() {
  //   try {
  //     const rs: any = await this.queueService.getWorking(this.servicePointId);
  //     if (rs.statusCode === 200) {
  //       this.workingItems = rs.results;
  //     } else {
  //       console.log(rs.message);
  //       this.alertService.error('เกิดข้อผิดพลาด');
  //     }
  //   } catch (error) {
  //     console.log(error);
  //     this.alertService.error();
  //   }
  // }

  async getCurrentQueue() {
    try {
      const rs: any = await this.queueService.getWorking(this.servicePointId);
      if (rs.statusCode === 200) {
        this.workingItems = rs.results;
        const arr = _.sortBy(rs.results, ['update_date']).reverse();

        if (arr.length > 0) {
          this.currentHn = arr[0].hn;
          this.currentQueueNumber = arr[0].queue_number;
          this.currentRoomName = arr[0].room_name;
          this.currentRoomNumber = arr[0].room_number;
        } else {
          this.currentHn = null;
          this.currentQueueNumber = null;
          this.currentRoomName = null;
          this.currentRoomNumber = null;
        }
      } else {
        console.log(rs.message);
        this.alertService.error('เกิดข้อผิดพลาด');
      }
    } catch (error) {
      console.log(error);
      this.alertService.error();
    }
  }
}
