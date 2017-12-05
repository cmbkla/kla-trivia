import {User} from './user.model';
import {MessageType} from './messageType';

export interface Message {
    from?: User;
    content?: any;
    type?: MessageType;
}
